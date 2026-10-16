from rest_framework import generics, permissions, status
from core.permissions import IsPlatformAdmin
from rest_framework.response import Response
from apps.catalog.models import ProductVariant
from .models import Cart, CartItem
from .serializers import AddToCartSerializer, CartSerializer


class BaseCartView:
    def get_cart(self, request):
        cart, _ = Cart.objects.get_or_create(user=request.user)
        return cart


class CartView(BaseCartView, generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return AddToCartSerializer
        return CartSerializer

    def get(self, request):
        """GET /api/v1/cart/ — Retorna o carrinho atual do usuário."""
        cart = self.get_cart(request)
        serializer = CartSerializer(cart, context={"request": request})
        return Response(serializer.data)

    def post(self, request):
        """POST /api/v1/cart/items/ — Adiciona um item ao carrinho."""
        cart = self.get_cart(request)
        serializer = AddToCartSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        variant_id = serializer.validated_data["variant_id"]
        quantity = serializer.validated_data["quantity"]
        variant = ProductVariant.objects.get(id=variant_id)

        item, created = CartItem.objects.get_or_create(cart=cart, variant=variant)
        if not created:
            new_qty = item.quantity + quantity
            if new_qty > variant.stock:
                return Response(
                    {"detail": f"Estoque insuficiente. Restam {variant.stock} unidades."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            item.quantity = new_qty
        else:
            item.quantity = quantity
        item.save()

        cart_serializer = CartSerializer(cart, context={"request": request})
        return Response(cart_serializer.data, status=status.HTTP_201_CREATED)


class CartItemDetailView(BaseCartView, generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    queryset = CartItem.objects.all()

    def get_serializer_class(self):
        return CartSerializer

    def patch(self, request, pk):
        """PATCH /api/v1/cart/items/{id}/ — Altera a quantidade de um item no carrinho."""
        cart = self.get_cart(request)
        try:
            item = cart.items.get(id=pk)
        except CartItem.DoesNotExist:
            return Response(
                {"detail": "Item do carrinho não encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )

        qty = request.data.get("quantity")
        if qty is None:
            return Response(
                {"detail": "O campo quantity é obrigatório."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            qty = int(qty)
            if qty < 1:
                raise ValueError
        except ValueError:
            return Response(
                {"detail": "Quantidade inválida."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if qty > item.variant.stock:
            return Response(
                {"detail": f"Estoque insuficiente. Restam {item.variant.stock} unidades."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        item.quantity = qty
        item.save()

        serializer = CartSerializer(cart, context={"request": request})
        return Response(serializer.data)

    def delete(self, request, pk):
        """DELETE /api/v1/cart/items/{id}/ — Remove um item do carrinho."""
        cart = self.get_cart(request)
        try:
            item = cart.items.get(id=pk)
        except CartItem.DoesNotExist:
            return Response(
                {"detail": "Item do carrinho não encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )

        item.delete()
        serializer = CartSerializer(cart, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)

from apps.orders.models import Coupon
from django.utils import timezone
from .serializers import ApplyCouponSerializer

class ApplyCouponView(BaseCartView, generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ApplyCouponSerializer

    def post(self, request):
        """POST /api/v1/cart/apply_coupon/"""
        cart = self.get_cart(request)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        code = serializer.validated_data["code"].strip().upper()

        try:
            coupon = Coupon.objects.get(code=code, active=True)
        except Coupon.DoesNotExist:
            return Response({"detail": "Cupom inválido ou expirado."}, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        if not (coupon.valid_from <= now <= coupon.valid_to):
            return Response({"detail": "Este cupom não está vigente."}, status=status.HTTP_400_BAD_REQUEST)
            
        # Regras de Negócio: Primeira compra
        if coupon.is_first_purchase_only:
            from apps.orders.models import Order
            if Order.objects.filter(user=request.user).exists():
                return Response({"detail": "Este cupom é válido apenas para a primeira compra."}, status=status.HTTP_400_BAD_REQUEST)
                
        # Valor mínimo do carrinho
        if coupon.min_cart_value and cart.subtotal < coupon.min_cart_value:
            return Response({"detail": f"Este cupom exige um valor mínimo de R$ {coupon.min_cart_value}."}, status=status.HTTP_400_BAD_REQUEST)
            
        # Limite de usos globais
        if coupon.max_uses is not None and coupon.current_uses >= coupon.max_uses:
            return Response({"detail": "Este cupom esgotou o limite de usos."}, status=status.HTTP_400_BAD_REQUEST)

        cart.coupon = coupon
        cart.save()

        return Response(CartSerializer(cart, context={"request": request}).data)


from rest_framework.views import APIView
from .tasks import send_abandoned_cart_emails_task

class TriggerAbandonedEmailsView(APIView):
    """
    POST /api/v1/cart/trigger-abandoned-emails/
    Dispara manualmente o envio de e-mails para carrinhos abandonados.
    """
    permission_classes = [IsPlatformAdmin]

    def post(self, request):
        result = send_abandoned_cart_emails_task()
        return Response({"status": "success", "result": result})


from apps.orders.services.melhor_envio import MelhorEnvioService
from .serializers import ShippingQuoteSerializer, ShippingSelectSerializer

class CartShippingQuoteView(BaseCartView, generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ShippingQuoteSerializer

    def post(self, request):
        """POST /api/v1/cart/shipping/quote/"""
        cart = self.get_cart(request)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        dest_cep = serializer.validated_data["destination_cep"]

        # Agrupar itens por lojista
        sellers_items = {}
        for item in cart.items.all():
            seller = item.variant.product.seller
            if seller not in sellers_items:
                sellers_items[seller] = []
            
            # Preparar payload pro Melhor Envio
            sellers_items[seller].append({
                "id": str(item.variant.id),
                "weight": float(item.variant.effective_weight or 0.5),
                "width": float(item.variant.effective_width or 11.0),
                "height": float(item.variant.effective_height or 2.0),
                "length": float(item.variant.effective_length or 16.0),
                "quantity": item.quantity,
                "insurance_value": float(item.variant.effective_price * item.quantity)
            })

        me_service = MelhorEnvioService()
        quotes = {}

        for seller, items in sellers_items.items():
            # Busca o CEP de origem direto do cadastro do Lojista
            origin_cep = seller.origin_cep or "01001000" # Fallback extremo se o lojista não tiver preenchido (só p/ lojas antigas)
            
            try:
                seller_quotes = me_service.calculate_shipping(origin_cep, dest_cep, items)
                quotes[str(seller.id)] = {
                    "store_name": seller.store_name,
                    "options": seller_quotes
                }
            except Exception as e:
                quotes[str(seller.id)] = {
                    "store_name": seller.store_name,
                    "error": str(e)
                }

        # Nova cotação invalida as escolhas anteriores (outro CEP, outra sacola).
        cart.destination_cep = dest_cep
        cart.selected_shipping = {}
        cart.save(update_fields=["destination_cep", "selected_shipping"])

        return Response(quotes)

class CartShippingSelectView(BaseCartView, generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ShippingSelectSerializer

    def post(self, request):
        """POST /api/v1/cart/shipping/select/"""
        cart = self.get_cart(request)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        selected = serializer.validated_data["selected_shipping"]
        
        # Validar basico
        if not isinstance(selected, dict):
            return Response({"detail": "Formato inválido. Esperado um dicionário."}, status=status.HTTP_400_BAD_REQUEST)

        cart.selected_shipping = selected
        cart.save(update_fields=["selected_shipping"])

        return Response(CartSerializer(cart, context={"request": request}).data)
