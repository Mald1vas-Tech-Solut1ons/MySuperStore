from rest_framework import permissions, status, viewsets
from core.permissions import IsPlatformAdmin
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Order
from .serializers import OrderCreateSerializer, OrderSerializer


class OrderViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = "order_number"
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        # Otimiza o carregamento de sub-pedidos, itens e vendedores em uma consulta reduzida
        return (
            Order.objects.filter(user=self.request.user)
            .select_related("payment")
            .prefetch_related(
                "sub_orders__items",
                "sub_orders__seller",
            )
        )

    def get_serializer_class(self):
        if self.action == "create":
            return OrderCreateSerializer
        return OrderSerializer

    def create(self, request, *args, **kwargs):
        """POST /api/v1/orders/ — Cria um pedido a partir do carrinho do usuário."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = serializer.save()
        
        # Retorna o pedido completo serializado
        response_serializer = OrderSerializer(order, context=self.get_serializer_context())
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

class SellerSubOrderViewSet(viewsets.ModelViewSet):
    """Endpoint exclusivo para lojistas gerenciarem o status dos pedidos (SubOrders)"""
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "patch", "options"]
    
    def get_queryset(self):
        from .models import SubOrder
        if not hasattr(self.request.user, "seller_profile"):
            return SubOrder.objects.none()
        return SubOrder.objects.filter(seller=self.request.user.seller_profile).order_by("-created_at")
        
    def get_serializer_class(self):
        from .serializers import SubOrderSerializer
        return SubOrderSerializer

    @action(detail=True, methods=["patch"])
    def update_status(self, request, pk=None):
        from django.utils import timezone
        sub_order = self.get_object()
        new_status = request.data.get("status")

        # Valida se o status está entre as escolhas válidas de pedido
        from .models import OrderStatus
        valid_statuses = [choice[0] for choice in OrderStatus.choices]

        if new_status not in valid_statuses:
            return Response({"error": "Status inválido."}, status=status.HTTP_400_BAD_REQUEST)
            
        sub_order.status = new_status
        
        tracking_code = request.data.get("tracking_code")
        if tracking_code is not None:
            sub_order.tracking_code = tracking_code
            
        carrier_name = request.data.get("carrier_name")
        if carrier_name is not None:
            sub_order.carrier_name = carrier_name
            
        estimated_delivery_date = request.data.get("estimated_delivery_date")
        if estimated_delivery_date:
            sub_order.estimated_delivery_date = estimated_delivery_date

        if new_status == OrderStatus.SHIPPED and not sub_order.dispatched_at:
            sub_order.dispatched_at = timezone.now()
            
        sub_order.save()
        
        # Disparar Notificação + E-mail para o Comprador
        from apps.users.notifications import notify_order_status_update
        notify_order_status_update(sub_order)
        
        serializer = self.get_serializer(sub_order)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def upload_invoice(self, request, pk=None):
        sub_order = self.get_object()
        invoice_link = request.data.get("invoice_link")
        
        if not invoice_link:
            return Response({"error": "O campo invoice_link é obrigatório."}, status=status.HTTP_400_BAD_REQUEST)
            
        sub_order.invoice_link = invoice_link
        sub_order.save(update_fields=["invoice_link"])
        
        from apps.users.notifications import notify_invoice_available
        notify_invoice_available(sub_order)
        
        return Response({"detail": "Nota Fiscal anexada com sucesso."})


class ReturnRequestViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "post", "patch", "options"]
    
    def get_queryset(self):
        from .models import ReturnRequest
        user = self.request.user
        if hasattr(user, "seller_profile"):
            # Lojista vê os pedidos de devolução das vendas dele
            return ReturnRequest.objects.filter(order_item__sub_order__seller=user.seller_profile).order_by("-created_at")
        else:
            # Cliente vê as próprias devoluções
            return ReturnRequest.objects.filter(order_item__sub_order__order__user=user).order_by("-created_at")
            
    def get_serializer_class(self):
        from .serializers import ReturnRequestSerializer
        return ReturnRequestSerializer

    def create(self, request, *args, **kwargs):
        """Cliente solicita devolução"""
        from .models import OrderItem, ReturnRequest
        order_item_id = request.data.get("order_item_id")
        reason = request.data.get("reason")
        customer_notes = request.data.get("customer_notes", "")
        
        try:
            order_item = OrderItem.objects.get(id=order_item_id, sub_order__order__user=request.user)
        except OrderItem.DoesNotExist:
            return Response({"error": "Item não encontrado no seu histórico de compras."}, status=404)
            
        if hasattr(order_item, 'return_request'):
            return Response({"error": "Este item já possui uma solicitação de devolução em andamento."}, status=400)
            
        if order_item.sub_order.status not in ["delivered", "shipped"]:
            return Response({"error": "Só é possível devolver itens enviados ou entregues."}, status=400)

        # Usar um serializer manual ou save direto
        rr = ReturnRequest.objects.create(
            order_item=order_item,
            reason=reason,
            customer_notes=customer_notes,
            status="requested"
        )
        
        serializer = self.get_serializer(rr)
        return Response(serializer.data, status=201)

    @action(detail=True, methods=["patch"])
    def update_status(self, request, pk=None):
        """Lojista atualiza o status da devolução"""
        from .models import ReturnRequest, ReturnStatus
        rr = self.get_object()
        
        if not hasattr(request.user, "seller_profile") or rr.order_item.sub_order.seller != request.user.seller_profile:
            return Response({"error": "Acesso negado. Apenas o lojista deste item pode atualizar o status."}, status=403)
            
        new_status = request.data.get("status")
        seller_notes = request.data.get("seller_notes")
        
        valid_statuses = [choice[0] for choice in ReturnStatus.choices]
        if new_status and new_status not in valid_statuses:
            return Response({"error": "Status inválido."}, status=400)
            
        if new_status:
            rr.status = new_status

            # Estorno do item: devolve o valor ao cliente (Efí) e o estoque ao vendedor
            if new_status == "refunded":
                # Uma devolução só é estornada uma vez (antes, reenviar o status estornava de novo).
                if ReturnRequest.objects.filter(pk=rr.pk, status="refunded").exists():
                    return Response({"error": "Esta devolução já foi estornada."}, status=400)
                self._process_item_refund(rr.order_item)

        if seller_notes is not None:
            rr.seller_notes = seller_notes

        rr.save()
        return Response(self.get_serializer(rr).data)

    def _process_item_refund(self, order_item):
        """Estorno referente a um único item devolvido.

        O valor é estornado ao cliente no provedor (cartão) e o estoque devolvido
        ao vendedor. Para evitar over-refund, só acionamos o provedor quando o
        estorno acumulado atinge o total do pedido (estorno integral); estornos
        parciais por item são registrados localmente até fechar o valor cheio.
        """
        from django.db import transaction
        from rest_framework.exceptions import ValidationError
        from apps.catalog.models import ProductVariant
        from apps.payments.models import Payment
        from apps.payments.refunds import RefundError, refund_payment

        sub_order = order_item.sub_order
        order = sub_order.order
        payment = Payment.objects.filter(order=order).first()

        with transaction.atomic():
            if payment:
                # Mesmas regras do estorno do pagamento: trava, teto, Efí confirma antes.
                try:
                    refund_payment(payment.pk, order_item.total)
                except RefundError as exc:
                    raise ValidationError({"detail": exc.message})

            # Devolve o item ao estoque do vendedor
            if order_item.variant_id:
                variant = ProductVariant.objects.select_for_update().get(id=order_item.variant_id)
                variant.stock += order_item.quantity
                variant.save(update_fields=["stock"])

            # Marca o sub-pedido como reembolsado
            sub_order.status = "refunded"
            sub_order.save(update_fields=["status", "updated_at"])

class ExpirePendingPixCronView(viewsets.GenericViewSet):
    """
    Endpoint para ser chamado via Cron Job (ex: Vercel Cron, cron-job.org)
    para expirar pagamentos PIX pendentes e devolver o estoque,
    substituindo o Celery worker em ambientes serverless.
    GET /api/v1/orders/cron/expire-pix/
    """
    permission_classes = [IsPlatformAdmin]

    @action(detail=False, methods=["get"])
    def run(self, request):
        from .tasks import expire_pending_pix_orders
        try:
            result = expire_pending_pix_orders()
            return Response({"status": "success", "result": result})
        except Exception as e:
            return Response({"status": "error", "detail": str(e)}, status=500)
