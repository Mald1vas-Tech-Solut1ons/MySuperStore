"""
Estorno único para todo o sistema (pagamento inteiro ou item devolvido).

Regras que valem para qualquer caminho:
- o Payment fica travado (select_for_update) durante todo o estorno: dois pedidos
  simultâneos não estornam o mesmo dinheiro duas vezes;
- teto: nunca estorna mais do que o saldo (valor pago − já estornado);
- o saldo estornado é ACUMULADO (antes era sobrescrito);
- só muda status/saldo depois que o Efí confirma; sem integração, recusa em vez de
  marcar "estornado" sem devolver o dinheiro;
- cartão: o Efí cancela a cobrança inteira, então só estorno integral;
- PIX: id de devolução único por estorno (derivado do saldo já estornado), então
  retentativas do MESMO estorno são idempotentes e estornos parciais não colidem.
"""
import logging
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from .models import Payment, PaymentMethod, PaymentStatus

logger = logging.getLogger(__name__)

CARD_METHODS = (PaymentMethod.CREDIT_CARD, PaymentMethod.DEBIT_CARD)


class RefundError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _efi_failed(resp) -> bool:
    """O SDK do Efí costuma DEVOLVER o erro (dict/str) em vez de lançar exceção."""
    if not isinstance(resp, dict):
        return True
    return bool(resp.get("erros") or resp.get("nome") or resp.get("error") or resp.get("code") not in (None, 200))


@transaction.atomic
def refund_payment(payment_id, amount=None):
    """Estorna `amount` (ou o saldo inteiro). Retorna (payment, valor_estornado, integral)."""
    from .services import EfiCardService, EfiPixService

    payment = Payment.objects.select_for_update().get(pk=payment_id)
    if payment.status != PaymentStatus.APPROVED:
        raise RefundError(f"Só é possível estornar pagamentos aprovados (atual: {payment.get_status_display()}).")

    already = Decimal(payment.refunded_amount or 0)
    remaining = Decimal(payment.amount) - already
    value = remaining if amount is None else Decimal(str(amount))
    if value <= 0 or value > remaining:
        raise RefundError(f"Valor inválido: o saldo estornável é R$ {remaining:.2f}.")

    if payment.method in CARD_METHODS:
        if not payment.efi_charge_id:
            raise RefundError("Pagamento sem cobrança no Efí: estorne manualmente pelo painel do Efí.", 409)
        if already > 0 or value != Decimal(payment.amount):
            raise RefundError("No cartão o estorno é integral (o Efí cancela a cobrança inteira).")
        try:
            resp = EfiCardService.refund_charge(payment.efi_charge_id)
        except Exception as exc:  # noqa: BLE001
            logger.error("Estorno de cartão falhou (pagamento %s): %s", payment.pk, exc)
            raise RefundError("O Efí não confirmou o estorno do cartão. Nada foi alterado; tente de novo.", 502)
        if _efi_failed(resp):
            logger.error("Estorno de cartão recusado (pagamento %s): %s", payment.pk, str(resp)[:300])
            raise RefundError("O Efí recusou o estorno do cartão. Nada foi alterado.", 502)

    elif payment.method == PaymentMethod.PIX:
        if not (payment.efi_txid and EfiPixService.is_configured()):
            raise RefundError("PIX sem cobrança no Efí: devolva manualmente pelo app do banco.", 409)
        devolution_id = f"d{payment.pk.hex[:20]}{int(already * 100)}"
        try:
            resp = EfiPixService.refund_pix(payment.efi_txid, value, devolution_id=devolution_id)
        except Exception as exc:  # noqa: BLE001
            logger.error("Devolução PIX falhou (pagamento %s): %s", payment.pk, exc)
            raise RefundError("O Efí não confirmou a devolução do PIX. Nada foi alterado; tente de novo.", 502)
        if not isinstance(resp, dict) or not (resp.get("id") or resp.get("rtrId") or resp.get("status")):
            logger.error("Devolução PIX recusada (pagamento %s): %s", payment.pk, str(resp)[:300])
            raise RefundError("O Efí recusou a devolução do PIX. Nada foi alterado.", 502)

    else:
        raise RefundError("Este método de pagamento não tem estorno automático: faça manualmente.", 409)

    payment.refunded_amount = already + value
    payment.refunded_at = timezone.now()
    full = payment.refunded_amount >= Decimal(payment.amount)
    if full:
        payment.status = PaymentStatus.REFUNDED
    payment.save(update_fields=["refunded_amount", "refunded_at", "status", "updated_at"])
    return payment, value, full
