"""
Lógica de negócio do ciclo de vida do pagamento, compartilhada entre o webhook do
Efí e a simulação de PIX.

Mantida fora de views.py/services.py para ser idempotente, testável e livre de
dependências de request HTTP.
"""
from django.db import transaction
from django.utils import timezone

from apps.orders.models import Order, OrderStatus
from .models import CommissionEntry, Payment, PaymentStatus, Payout, PayoutStatus


@transaction.atomic
def process_successful_payment(order: Order, raw_response: dict | None = None, charge_id: str = "") -> bool:
    """
    Confirma um pedido pago: marca Payment/Order/SubOrders como confirmados, registra
    comissões, executa o split e cria os
    Payouts. Idempotente — chamadas repetidas para um pedido já confirmado são no-op.

    Retorna True se processou agora, False se já estava confirmado.
    """
    # Bloqueia a linha do pedido para evitar corrida entre webhook e confirmação manual
    order = Order.objects.select_for_update().get(id=order.id)
    if order.status == OrderStatus.CONFIRMED:
        return False

    raw_response = raw_response or {}

    # 1. Pagamento
    payment = Payment.objects.filter(order=order).first()
    if payment:
        payment.status = PaymentStatus.APPROVED
        payment.paid_at = timezone.now()
        if charge_id:
            payment.efi_charge_id = charge_id
        if raw_response:
            payment.raw_response = raw_response
        payment.save(update_fields=["status", "paid_at", "efi_charge_id", "raw_response", "updated_at"])

    # 2. Order + SubOrders → confirmados; registra comissão da plataforma
    order.status = OrderStatus.CONFIRMED
    order.save(update_fields=["status", "updated_at"])

    for sub_order in order.sub_orders.all():
        sub_order.status = OrderStatus.CONFIRMED
        sub_order.save(update_fields=["status", "updated_at"])

        if sub_order.seller and not hasattr(sub_order, "commission_entry"):
            CommissionEntry.objects.create(
                sub_order=sub_order,
                amount=sub_order.commission,
                rate=sub_order.seller.commission_rate,
            )

    # 3. Split de pagamento + Payouts
    #
    # O repasse só é COMPLETED quando houve split nativo do Efí — isto é, quando o
    # lojista tem `efi_payee_code` (efi_authorized). Nesse caso o Efí credita a
    # parte do lojista direto na conta dele (tanto no PIX `repasses` quanto no
    # split de Cobranças/cartão), independentemente do método.
    #
    # Sem payee_code não há split: o valor inteiro cai na conta master da
    # plataforma e o repasse fica PENDENTE — sinalizando uma dívida real com o
    # lojista, a ser liquidada manualmente (ou por job de PIX-out futuro). Antes,
    # cartão sem payee era marcado COMPLETED por engano (lojista nunca recebia).
    transfer_id = raw_response.get("id", "") if raw_response else ""
    for sub_order in order.sub_orders.all():
        if hasattr(sub_order, "payout"):
            continue
        seller = sub_order.seller

        settled_via_split = bool(seller and seller.efi_authorized)
        # Loja da casa: o dinheiro já está na conta master, que é a conta dela.
        settled_in_master = bool(seller and seller.receives_in_master)
        payout_status = (
            PayoutStatus.COMPLETED if (settled_via_split or settled_in_master) else PayoutStatus.PENDING
        )

        Payout.objects.create(
            sub_order=sub_order,
            seller=seller,
            amount=sub_order.seller_amount,
            status=payout_status,
            mp_payout_id=transfer_id,
            processed_at=timezone.now() if payout_status == PayoutStatus.COMPLETED else None,
        )

    # 4. Limpa os itens do carrinho que foram efetivamente pagos neste pedido
    if order.user_id:
        from apps.carts.models import Cart
        cart = Cart.objects.filter(user=order.user).first()
        if cart:
            variant_ids = [item.variant_id for sub in order.sub_orders.all() for item in sub.items.all()]
            cart.items.filter(variant_id__in=variant_ids).delete()

    return True


def settle_payout(payout: Payout) -> bool:
    """
    Liquida UM repasse pendente enviando PIX (Pix Envio) do caixa master para a
    chave PIX do lojista. Idempotente: o `idEnvio` é o id do payout, então reenviar
    o mesmo payout não gera pagamento duplicado no Efí.

    Usado para lojistas SEM conta Efí (sem split nativo) — quem tem payee_code já
    recebeu direto no pagamento e o payout já nasce COMPLETED.

    Retorna True se liquidou agora; False se não havia o que fazer ou falhou
    (mantém PENDING para nova tentativa; o erro é logado).
    """
    import logging
    from apps.payments.services import EfiPixService

    logger = logging.getLogger(__name__)

    if payout.status == PayoutStatus.COMPLETED:
        return False
    seller = payout.seller
    if seller and seller.receives_in_master:
        # Nunca enviar Pix da master para ela mesma (repasses antigos de loja da casa).
        return False
    if not seller or not seller.pix_key:
        logger.warning("Payout %s sem chave PIX do lojista — não é possível liquidar.", payout.id)
        return False
    if not EfiPixService.is_configured():
        logger.warning("Efí PIX não configurado — repasse %s segue PENDENTE.", payout.id)
        return False

    payout.status = PayoutStatus.PROCESSING
    payout.save(update_fields=["status"])

    order_number = getattr(getattr(payout.sub_order, "order", None), "order_number", "")
    try:
        resp = EfiPixService.send_to_seller(
            pix_key=seller.pix_key,
            amount=payout.amount,
            id_envio=str(payout.id),
            info=f"Repasse {order_number}".strip(),
        )
    except Exception as exc:
        payout.status = PayoutStatus.PENDING
        payout.save(update_fields=["status"])
        logger.error("Falha ao enviar repasse %s: %s", payout.id, exc)
        return False

    # O Efí pode devolver string em erro; só dict com e2eId/status indica sucesso.
    if isinstance(resp, dict):
        e2e = resp.get("e2eId") or resp.get("endToEndId") or resp.get("idEnvio") or ""
        st = (resp.get("status") or "").upper()
        if e2e or st in ("REALIZADO", "EM_PROCESSAMENTO"):
            payout.status = PayoutStatus.COMPLETED
            payout.mp_payout_id = str(e2e) or payout.mp_payout_id
            payout.processed_at = timezone.now()
            payout.save(update_fields=["status", "mp_payout_id", "processed_at"])
            return True

    # Sem sucesso (ex.: escopo Pix Envio não habilitado): volta a PENDENTE p/ retry.
    payout.status = PayoutStatus.PENDING
    payout.save(update_fields=["status"])
    logger.warning("Repasse %s não liquidado (resposta do Efí: %s).", payout.id, str(resp)[:200])
    return False


def settle_pending_payouts(order: Order | None = None) -> dict:
    """
    Tenta liquidar todos os repasses PENDENTES (de um pedido específico ou de todos).
    Retorna um resumo {processados, liquidados, falhas}.
    """
    qs = Payout.objects.filter(status=PayoutStatus.PENDING).select_related("seller", "sub_order__order")
    if order is not None:
        qs = qs.filter(sub_order__order=order)

    processed = settled = failed = 0
    for payout in qs:
        processed += 1
        if settle_payout(payout):
            settled += 1
        else:
            failed += 1
    return {"processados": processed, "liquidados": settled, "falhas": failed}


def dispatch_post_payment_tasks(order: Order) -> None:
    """Dispara e-mail de confirmação e webhook para ERP externo (fora da transação)."""
    from apps.orders.tasks import send_order_confirmation_email_task, send_seller_sale_notification_email_task
    from .tasks import dispatch_webhook_task

    import logging
    logger = logging.getLogger(__name__)
    try:
        # Executa sincronamente (chamando como função normal em vez de .delay)
        # para garantir a entrega caso o Celery não esteja rodando em produção.
        send_order_confirmation_email_task(str(order.id))
        send_seller_sale_notification_email_task(str(order.id))
        dispatch_webhook_task({
            "event": "order.confirmed",
            "order_number": order.order_number,
            "amount": float(order.total),
            "timestamp": timezone.now().isoformat(),
        })
    except Exception as e:
        logger.error(f"Failed to dispatch post-payment tasks for order {order.id}: {e}")

    # Tenta liquidar os repasses pendentes deste pedido (lojistas sem split nativo).
    # Best-effort: se o escopo Pix Envio não estiver habilitado, fica PENDENTE para
    # o job periódico reprocessar — nunca derruba a confirmação do pedido.
    try:
        settle_pending_payouts(order)
    except Exception as e:
        logger.error(f"Falha ao liquidar repasses do pedido {order.id}: {e}")


@transaction.atomic
def restore_stock(order: Order) -> None:
    """Devolve ao estoque as quantidades de todos os itens do pedido (cancelamento/estorno)."""
    from apps.catalog.models import ProductVariant

    for sub_order in order.sub_orders.all():
        for item in sub_order.items.all():
            if item.variant_id:
                variant = ProductVariant.objects.select_for_update().get(id=item.variant_id)
                variant.stock += item.quantity
                variant.save(update_fields=["stock"])