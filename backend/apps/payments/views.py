from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

import logging
logger = logging.getLogger(__name__)

from apps.orders.models import Order, OrderStatus
from .models import Payment, PaymentMethod, PaymentStatus
from .processing import (
    dispatch_post_payment_tasks,
    process_successful_payment,
    restore_stock,
)
from .serializers import ProcessPaymentSerializer, PaymentSerializer, RefundSerializer
from .services import EfiCardService, EfiPixService, PixService

class PaymentViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = PaymentSerializer
    queryset = Payment.objects.all()
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        # Sem isto, GET /payments/ listava os pagamentos de TODOS os usuários.
        return Payment.objects.filter(order__user=self.request.user)

    def create(self, request, *args, **kwargs):
        return Response(
            {"detail": "Utilize POST /api/v1/payments/process/ para iniciar o checkout."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    def retrieve(self, request, pk=None):
        try:
            payment = Payment.objects.get(id=pk, order__user=request.user)
        except Payment.DoesNotExist:
            return Response({"detail": "Pagamento não encontrado."}, status=status.HTTP_404_NOT_FOUND)
        return Response(self.get_serializer(payment).data)

@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def process_payment_view(request):
    """
    POST /api/v1/payments/process/
    Processa o pagamento via Efí.
    """
    serializer = ProcessPaymentSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)
    
    order = Order.objects.get(id=serializer.validated_data["order_id"])
    method = serializer.validated_data["payment_method"]

    payment, _ = Payment.objects.get_or_create(
        order=order,
        defaults={"method": method, "amount": order.total, "status": PaymentStatus.PENDING},
    )
    payment.method = method
    payment.amount = order.total
    payment.status = PaymentStatus.PENDING
    payment.save()

    if method == PaymentMethod.PIX:
        if EfiPixService.is_configured():
            try:
                txid, copia_cola, qr_base64 = EfiPixService.create_charge(order)
                payment.efi_txid = txid
                payment.pix_qr_code = copia_cola
                payment.pix_qr_code_base64 = qr_base64
                payment.raw_response = {"provider": "efi", "txid": txid}
                payment.save()
            except Exception as exc:
                logger.error("Falha ao criar cobrança PIX no Efí: %s", exc)
                # Fallback
                copia_cola, qr_base64 = PixService.generate_brcode(order)
                payment.pix_qr_code = copia_cola
                payment.pix_qr_code_base64 = qr_base64
                payment.raw_response = {"provider": "local"}
                payment.save()
        else:
            copia_cola, qr_base64 = PixService.generate_brcode(order)
            payment.pix_qr_code = copia_cola
            payment.pix_qr_code_base64 = qr_base64
            payment.raw_response = {"provider": "local"}
            payment.save()
        try:
            from apps.users.notifications import notify_order_pending_customer
            notify_order_pending_customer(order)
        except Exception as e:
            logger.error("Falha ao enviar notificacao de PIX pendente: %s", e)

        return Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)

    elif method in (PaymentMethod.CREDIT_CARD, PaymentMethod.DEBIT_CARD):
        response = EfiCardService.create_card_charge(
            order=order,
            payment_token=serializer.validated_data["payment_token"],
            installments=serializer.validated_data["installments"],
            customer_data=serializer.validated_data["customer"],
            billing_address=serializer.validated_data["billing_address"]
        )
        
        if response.get("success"):
            payment.efi_charge_id = response.get("charge_id")
            payment.raw_response = response.get("raw_response")
            
            # API One-Step retorna o status da cobrança. Status do Efí Cobranças que
            # significam pagamento efetivado no cartão: "approved" (autorizado),
            # "paid"/"settled" (liquidado). Normalizamos para minúsculas.
            charge_status = (response.get("status") or "").lower()
            PAID_STATUSES = {"approved", "paid", "settled"}
            if charge_status in PAID_STATUSES:
                processed = process_successful_payment(
                    order, raw_response=response.get("raw_response"), charge_id=response.get("charge_id")
                )
                if processed:
                    dispatch_post_payment_tasks(order)
                payment.refresh_from_db()
            else:
                # "new"/"waiting"/"unpaid"/"identified": aguarda confirmação (notificação Efí).
                payment.save()

            return Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)
        else:
            payment.status = PaymentStatus.REJECTED
            payment.save()
            return Response(
                {"detail": response.get("error", "Erro ao processar cartão.")},
                status=status.HTTP_400_BAD_REQUEST
            )


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def simulate_pix_payment_view(request, pk):
    """
    POST /api/v1/payments/{id}/simulate-pix/
    """
    if not settings.DEBUG:
        return Response({"detail": "Indisponível em produção."}, status=status.HTTP_403_FORBIDDEN)

    try:
        payment = Payment.objects.get(id=pk, order__user=request.user, method=PaymentMethod.PIX)
    except Payment.DoesNotExist:
        return Response({"detail": "Pagamento PIX não encontrado."}, status=status.HTTP_404_NOT_FOUND)

    processed = process_successful_payment(
        payment.order, raw_response={"simulated_pix": True, "metadata": {"type": "pix"}}
    )
    if processed:
        dispatch_post_payment_tasks(payment.order)

    payment.refresh_from_db()
    return Response(PaymentSerializer(payment, context={"request": request}).data)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def confirm_pix_view(request, pk):
    """
    POST /api/v1/payments/{id}/confirm-pix/
    Consulta a cobrança no Efí (polling).
    """
    try:
        payment = Payment.objects.get(id=pk, order__user=request.user, method=PaymentMethod.PIX)
    except Payment.DoesNotExist:
        return Response({"detail": "Pagamento PIX não encontrado."}, status=status.HTTP_404_NOT_FOUND)

    if payment.status == PaymentStatus.APPROVED:
        return Response(PaymentSerializer(payment, context={"request": request}).data)

    txid = payment.efi_txid
    if not (txid and EfiPixService.is_configured()):
        return Response(
            {"detail": "Confirmação automática indisponível; aguardando baixa.", "status": payment.status},
            status=status.HTTP_202_ACCEPTED,
        )

    if EfiPixService.is_paid(txid):
        processed = process_successful_payment(
            payment.order, raw_response={"provider": "efi", "txid": txid, "metadata": {"type": "pix"}}
        )
        if processed:
            dispatch_post_payment_tasks(payment.order)
        payment.refresh_from_db()
        return Response(PaymentSerializer(payment, context={"request": request}).data)

    return Response(
        {"detail": "Pagamento ainda não identificado.", "status": payment.status},
        status=status.HTTP_202_ACCEPTED,
    )


@csrf_exempt
@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def efi_webhook(request):
    """
    POST /api/v1/payments/efi-webhook/
    """
    import hmac as _hmac
    import logging
    from decimal import Decimal, InvalidOperation

    logger = logging.getLogger(__name__)

    # O endpoint é público (o Efí não autentica por JWT). Sem prova de origem,
    # qualquer um que soubesse um txid marcaria o pedido como pago. O segredo vai
    # na URL registrada no Efí (register_efi_webhook já anexa ?hmac=...&ignorar=).
    secret = getattr(settings, "EFI_WEBHOOK_SECRET", "")
    if not secret:
        if not settings.DEBUG:
            logger.error("EFI_WEBHOOK_SECRET ausente — webhook Pix recusado (fail-closed).")
            return Response({"detail": "Webhook não configurado."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    elif not _hmac.compare_digest(request.query_params.get("hmac", ""), secret):
        logger.warning("Webhook Pix com hmac inválido (ip=%s).", request.META.get("REMOTE_ADDR"))
        return Response({"detail": "Não autorizado."}, status=status.HTTP_401_UNAUTHORIZED)

    data = request.data if isinstance(request.data, dict) else {}
    for pix in data.get("pix", []) or []:
        txid = pix.get("txid")
        if not txid:
            continue
        payment = Payment.objects.filter(efi_txid=txid, method=PaymentMethod.PIX).first()
        if payment and payment.status != PaymentStatus.APPROVED:
            try:
                paid = Decimal(str(pix.get("valor", "0")))
            except InvalidOperation:
                paid = Decimal("0")
            if paid < payment.amount:
                logger.error("Pix %s pago a menor (%s < %s) — não confirmado.", txid, paid, payment.amount)
                continue
            processed = process_successful_payment(
                payment.order, raw_response={"provider": "efi", "txid": txid, "metadata": {"type": "pix"}}
            )
            if processed:
                dispatch_post_payment_tasks(payment.order)
    return Response({"status": "ok"}, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def cancel_payment_view(request, pk):
    """
    POST /api/v1/payments/{id}/cancel/
    """
    try:
        payment = Payment.objects.get(id=pk, order__user=request.user)
    except Payment.DoesNotExist:
        return Response({"detail": "Pagamento não encontrado."}, status=status.HTTP_404_NOT_FOUND)

    order = payment.order
    if order.status not in (OrderStatus.PENDING,):
        return Response(
            {"detail": f"Não é possível cancelar um pedido '{order.get_status_display()}'. Use estorno."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    with transaction.atomic():
        # Para cartão, deveríamos tentar cancelar no Efi também caso tenha sido autorizado mas não liquidado
        if payment.efi_charge_id and payment.method != PaymentMethod.PIX:
            try:
                EfiCardService.refund_charge(payment.efi_charge_id)
            except Exception as e:
                logger.warning(f"Não foi possível cancelar cobrança Efí {payment.efi_charge_id}: {e}")
        
        restore_stock(order)
        payment.status = PaymentStatus.CANCELLED
        payment.save(update_fields=["status", "updated_at"])
        order.status = OrderStatus.CANCELLED
        order.save(update_fields=["status", "updated_at"])
        for sub in order.sub_orders.all():
            sub.status = OrderStatus.CANCELLED
            sub.save(update_fields=["status", "updated_at"])

    return Response({"detail": "Pedido cancelado e estoque restaurado.",
                     "order_status": order.status})


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def refund_payment_view(request, pk):
    """
    POST /api/v1/payments/{id}/refund/
    """
    try:
        payment = Payment.objects.get(id=pk)
    except Payment.DoesNotExist:
        return Response({"detail": "Pagamento não encontrado."}, status=status.HTTP_404_NOT_FOUND)

    order = payment.order
    is_owner = order.user_id == request.user.id
    is_admin = getattr(request.user, "role", None) == "admin" or request.user.is_staff
    if not (is_owner or is_admin):
        return Response({"detail": "Sem permissão para estornar este pedido."},
                        status=status.HTTP_403_FORBIDDEN)

    if payment.status != PaymentStatus.APPROVED:
        return Response(
            {"detail": f"Só é possível estornar pagamentos aprovados (atual: {payment.get_status_display()})."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    ser = RefundSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    amount = ser.validated_data.get("amount")

    refund_value = amount if amount is not None else payment.amount

    with transaction.atomic():
        if payment.method in (PaymentMethod.CREDIT_CARD, PaymentMethod.DEBIT_CARD) and payment.efi_charge_id:
            try:
                # Se for estorno parcial, pode não ser suportado nativamente por default
                # no One-Step, mas a SDK permite
                EfiCardService.refund_charge(payment.efi_charge_id, amount=amount)
            except Exception as e:
                return Response({"detail": f"Erro no Efí: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)
        elif payment.method == PaymentMethod.PIX and payment.efi_txid and EfiPixService.is_configured():
            try:
                # Devolução do PIX no Efí (pix_devolution). idempotente pelo id da devolução.
                EfiPixService.refund_pix(
                    payment.efi_txid, refund_value, devolution_id=f"dev{payment.id}",
                )
            except Exception as e:
                return Response({"detail": f"Erro ao devolver PIX no Efí: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

        refunded_total = amount if amount is not None else payment.amount
        payment.refunded_amount = refunded_total
        payment.refunded_at = timezone.now()
        
        full_refund = refunded_total >= payment.amount
        if full_refund:
            payment.status = PaymentStatus.REFUNDED
        payment.save(update_fields=[
            "refunded_amount", "refunded_at", "status", "updated_at",
        ])

        if full_refund:
            restore_stock(order)
            order.status = OrderStatus.REFUNDED
            order.save(update_fields=["status", "updated_at"])
            for sub in order.sub_orders.all():
                sub.status = OrderStatus.REFUNDED
                sub.save(update_fields=["status", "updated_at"])

    return Response({
        "detail": "Estorno processado." if full_refund else "Estorno parcial processado.",
        "refunded_amount": str(refunded_total),
        "order_status": order.status,
    })
