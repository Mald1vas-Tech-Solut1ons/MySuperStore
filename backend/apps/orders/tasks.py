from celery import shared_task
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from .models import Order


@shared_task
def send_order_confirmation_email_task(order_id):
    try:
        order = Order.objects.get(id=order_id)
    except Order.DoesNotExist:
        return f"Pedido {order_id} não encontrado."

    from apps.users.notifications import notify_order_confirmed_customer
    notify_order_confirmed_customer(order)
    return f"Notificações de confirmação enviadas para o pedido #{order.order_number}"


@shared_task
def send_seller_sale_notification_email_task(order_id):
    try:
        order = Order.objects.get(id=order_id)
    except Order.DoesNotExist:
        return f"Pedido {order_id} não encontrado."

    from apps.users.notifications import notify_new_sale_seller
    for sub_order in order.sub_orders.select_related("seller__user"):
        if sub_order.seller and sub_order.seller.user.email:
            notify_new_sale_seller(sub_order)

    return f"Notificações de nova venda enviadas para os vendedores do pedido #{order.order_number}"


def expire_pending_pix_orders():
    """
    Monitora pedidos PIX pendentes.
    - Se > 10 min: envia lembrete de carrinho/PIX abandonado.
    - Se > 60 min: cancela pedido, expira PIX e devolve o estoque.
    """
    from django.utils import timezone
    from datetime import timedelta
    from django.db import transaction
    from apps.orders.models import OrderStatus
    from apps.payments.models import PaymentStatus, Payment
    from apps.catalog.models import ProductVariant

    now = timezone.now()
    ten_mins_ago = now - timedelta(minutes=10)
    sixty_mins_ago = now - timedelta(minutes=60)

    # 1. Enviar Lembrete (pedidos pendentes criados entre 10 e 15 minutos atrás, para enviar só uma vez)
    fifteen_mins_ago = now - timedelta(minutes=15)
    orders_to_remind = Order.objects.filter(
        status=OrderStatus.PENDING,
        created_at__lte=ten_mins_ago,
        created_at__gt=fifteen_mins_ago
    )
    for order in orders_to_remind:
        # Apenas para pagamentos PIX
        payment = Payment.objects.filter(order=order).first()
        if payment and payment.method == "pix" and payment.status == PaymentStatus.PENDING:
            # Enviar e-mail/notificação
            from apps.users.notifications import notify_order_pending_customer
            # Evita envio duplicado verificando log ou flag, mas pelo filtro de tempo já limita.
            try:
                notify_order_pending_customer(order)
            except Exception as e:
                pass

    # 2. Cancelar Pedidos abandonados (pendentes > 60 min).
    # O estoque é baixado na criação do pedido, então TODO pedido pendente que não vai
    # mais ser pago precisa devolvê-lo: PIX não pago, pedido sem pagamento iniciado
    # (cliente desistiu antes de escolher o método) e cartão recusado/cancelado.
    orders_to_cancel = Order.objects.filter(
        status=OrderStatus.PENDING,
        created_at__lte=sixty_mins_ago
    )

    cancelled = 0
    for order in orders_to_cancel:
        with transaction.atomic():
            order = Order.objects.select_for_update().get(id=order.id)
            if order.status != OrderStatus.PENDING:
                continue

            # Relê o pagamento DENTRO da trava: o cliente pode ter tentado pagar de novo
            # (cartão recusado volta a PENDING) entre a consulta acima e agora.
            payment = Payment.objects.select_for_update().filter(order=order).first()
            if not _is_abandoned(payment):
                continue

            # Cancela Pedido e Sub-pedidos
            order.status = OrderStatus.CANCELLED
            order.save(update_fields=["status", "updated_at"])

            for sub in order.sub_orders.all():
                sub.status = OrderStatus.CANCELLED
                sub.save(update_fields=["status", "updated_at"])

            # Cancela o Payment que ainda aguardava (recusado/cancelado já é final)
            if payment and payment.status == PaymentStatus.PENDING:
                payment.status = PaymentStatus.CANCELLED
                payment.save(update_fields=["status", "updated_at"])

            # Devolve Estoque
            for sub in order.sub_orders.all():
                for item in sub.items.all():
                    if item.variant_id:
                        variant = ProductVariant.objects.select_for_update().get(id=item.variant_id)
                        variant.stock += item.quantity
                        variant.save(update_fields=["stock"])
            cancelled += 1

    return f"Checagem concluída. Avisos enviados; {cancelled} pedido(s) expirado(s)."


def _is_abandoned(payment) -> bool:
    """True se um pedido pendente há mais de 60 min não tem mais como ser pago.

    - sem pagamento iniciado: o cliente desistiu antes de escolher o método;
    - PIX ainda pendente E com o QR vencido: o cliente não consegue mais pagar;
    - cartão recusado ou cancelado: não há cobrança em andamento.
    Cartão ainda PENDING/IN_PROCESS é mantido: aguarda a confirmação do Efí.
    PIX com o QR ainda válido também é mantido: cancelar agora abriria a janela do "PIX pago
    depois do cancelamento" (o pedido morre, o QR continua pagável).
    """
    from django.utils import timezone
    from apps.payments.models import PaymentMethod, PaymentStatus

    if payment is None:
        return True
    if payment.method == PaymentMethod.PIX:
        if payment.status != PaymentStatus.PENDING:
            return False
        # expires_at é gravado ao criar a cobrança; sem ele (pagamentos antigos), vale só o tempo do pedido.
        return payment.expires_at is None or payment.expires_at <= timezone.now()
    return payment.status in (PaymentStatus.REJECTED, PaymentStatus.CANCELLED)

@shared_task
def check_pending_pix_orders_task():
    return expire_pending_pix_orders()
