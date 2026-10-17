import redis
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from apps.carts.models import Cart
from apps.catalog.models import ProductVariant
from .models import Order, OrderItem, SubOrder, ReturnRequest

class ReturnRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReturnRequest
        fields = ["id", "reason", "status", "customer_notes", "seller_notes", "created_at", "updated_at"]

class OrderItemSerializer(serializers.ModelSerializer):
    return_request = ReturnRequestSerializer(read_only=True)

    class Meta:
        model = OrderItem
        fields = [
            "id",
            "product_name",
            "variant_sku",
            "variant_attributes",
            "quantity",
            "unit_price",
            "total",
            "return_request",
            "created_at",
        ]


class SubOrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    seller_name = serializers.CharField(source="seller.store_name", read_only=True)

    class Meta:
        model = SubOrder
        fields = [
            "id",
            "seller",
            "seller_name",
            "subtotal",
            "shipping",
            "commission",
            "seller_amount",
            "status",
            "tracking_code",
            "carrier_name",
            "estimated_delivery_date",
            "dispatched_at",
            "invoice_link",
            "items",
            "created_at",
            "updated_at",
        ]


class OrderSerializer(serializers.ModelSerializer):
    sub_orders = SubOrderSerializer(many=True, read_only=True)
    payment = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            "id",
            "order_number",
            "subtotal",
            "shipping",
            "total",
            "status",
            "address_recipient",
            "address_cep",
            "address_logradouro",
            "address_numero",
            "address_complemento",
            "address_bairro",
            "address_cidade",
            "address_uf",
            "notes",
            "payment",
            "sub_orders",
            "created_at",
            "updated_at",
        ]

    def get_payment(self, obj):
        p = getattr(obj, "payment", None)
        if not p:
            return None
        return {
            "id": str(p.id),
            "status": p.status,
            "method": p.method,
            "refunded_amount": str(p.refunded_amount),
        }


class OrderCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Order
        fields = [
            "address_recipient",
            "address_cep",
            "address_logradouro",
            "address_numero",
            "address_complemento",
            "address_bairro",
            "address_cidade",
            "address_uf",
            "notes",
            "coupon_code",
        ]

    coupon_code = serializers.CharField(required=False, write_only=True)

    def validate(self, data):
        user = self.context["request"].user
        try:
            cart = Cart.objects.get(user=user)
        except Cart.DoesNotExist:
            raise serializers.ValidationError("Carrinho não encontrado.")

        if not cart.items.exists():
            raise serializers.ValidationError("O carrinho está vazio.")

        # Validação transacional de estoque
        for item in cart.items.all():
            variant = item.variant
            if variant.stock < item.quantity:
                raise serializers.ValidationError(
                    f"Estoque insuficiente para o produto {variant.product.name} ({variant.sku}). Restam apenas {variant.stock} unidades."
                )

        coupon_code = data.get("coupon_code")
        if coupon_code:
            from apps.orders.models import Coupon
            from django.utils import timezone
            try:
                coupon = Coupon.objects.get(code=coupon_code, active=True)
                now = timezone.now()
                if now < coupon.valid_from or now > coupon.valid_to:
                    raise serializers.ValidationError({"coupon_code": "Este cupom expirou ou ainda não é válido."})
                # Check if it's seller specific
                if coupon.seller:
                    # check if any item is from this seller
                    seller_matched = any(item.variant.product.seller == coupon.seller for item in cart.items.all())
                    if not seller_matched:
                        raise serializers.ValidationError({"coupon_code": f"Este cupom só é válido para produtos da loja {coupon.seller.store_name}."})
            except Coupon.DoesNotExist:
                raise serializers.ValidationError({"coupon_code": "Cupom inválido ou inativo."})

        return data

    def create(self, validated_data):
        user = self.context["request"].user
        cart = Cart.objects.get(user=user)
        cart_items = list(cart.items.all())

        # Conectar ao Redis
        try:
            redis_client = redis.from_url(settings.CELERY_BROKER_URL)
        except Exception:
            redis_client = None

        with transaction.atomic():
            # 1. Bloqueia os registros no banco para evitar race conditions
            for item in cart_items:
                ProductVariant.objects.select_for_update().get(id=item.variant.id)

            # 2. Gera o número do pedido legível
            import datetime
            import random
            current_date = datetime.date.today().strftime("%Y%m%d")
            rand_suffix = "".join(random.choices("0123456789", k=4))
            order_number = f"{current_date}-{rand_suffix}"

            # 3. Calcula totais do pedido principal
            from decimal import Decimal, ROUND_HALF_UP
            subtotal = sum(item.subtotal for item in cart_items)
            # Frete: o CLIENTE paga. Vem das cotações que ele selecionou no carrinho
            # (cart.selected_shipping = {seller_id: {price, ...}}, via Melhor Envio).
            selected_shipping = cart.selected_shipping or {}
            shipping = cart.quoted_shipping_total  # frete cotado; o grátis é decidido abaixo, com o desconto deste pedido

            # Sem código explícito, vale o cupom aplicado na sacola: o total que o
            # cliente viu já tinha esse desconto e o pedido precisa bater com ele.
            coupon_code = validated_data.pop("coupon_code", None) or (cart.coupon.code if cart.coupon_id else None)
            discount = 0
            coupon = None
            if coupon_code:
                from django.db.models import F
                from apps.orders.models import Coupon, Order as OrderModel

                # O "aplicar cupom" do carrinho é só consultivo: aqui, dentro da
                # transação e com o cupom travado, revalida tudo e consome 1 uso.
                # Sem isto o contador nunca subia e max_uses/1ª compra eram burláveis.
                coupon = Coupon.objects.select_for_update().filter(code=coupon_code).first()
                now = timezone.now()
                if not coupon or not coupon.active or not (coupon.valid_from <= now <= coupon.valid_to):
                    raise serializers.ValidationError({"coupon_code": "Cupom inválido, inativo ou fora da vigência."})
                if coupon.max_uses is not None and coupon.current_uses >= coupon.max_uses:
                    raise serializers.ValidationError({"coupon_code": "Este cupom esgotou o limite de usos."})
                if coupon.min_cart_value and Decimal(str(subtotal)) < coupon.min_cart_value:
                    raise serializers.ValidationError({"coupon_code": f"Este cupom exige um valor mínimo de R$ {coupon.min_cart_value}."})
                if coupon.is_first_purchase_only and OrderModel.objects.filter(user=user).exists():
                    raise serializers.ValidationError({"coupon_code": "Este cupom é válido apenas para a primeira compra."})
                if coupon.seller and not any(item.variant.product.seller_id == coupon.seller_id for item in cart_items):
                    raise serializers.ValidationError({"coupon_code": "Este cupom não vale para os produtos do carrinho."})
                Coupon.objects.filter(pk=coupon.pk).update(current_uses=F("current_uses") + 1)

                if coupon.discount_percentage:
                    # Discount only applies to the seller's items if it's a seller coupon
                    if coupon.seller:
                        seller_subtotal = sum(item.subtotal for item in cart_items if item.variant.product.seller == coupon.seller)
                        discount = seller_subtotal * (coupon.discount_percentage / 100)
                    else:
                        discount = subtotal * (coupon.discount_percentage / 100)
                elif coupon.discount_amount:
                    discount = coupon.discount_amount

                validated_data["notes"] = f"Cupom aplicado: {coupon_code} (-R$ {discount:.2f})\n" + validated_data.get("notes", "")

            # Frete grátis medido nos produtos já com o desconto DESTE pedido (o servidor decide,
            # não o carrinho: o cupom do checkout pode diferir do salvo no carrinho).
            from django.conf import settings as dj_settings
            free_shipping = (Decimal(str(subtotal)) - Decimal(str(discount or 0))) >= dj_settings.FREE_SHIPPING_MIN
            if free_shipping:
                shipping = Decimal("0")
            # Total final = (produtos - desconto) + frete. O desconto NÃO incide no frete.
            total = max(Decimal("0"), Decimal(str(subtotal)) - Decimal(str(discount or 0))) + Decimal(str(shipping))

            # 4. Cria a Order principal
            order = Order.objects.create(
                user=user,
                order_number=order_number,
                subtotal=subtotal,
                shipping=shipping,
                total=total,
                ip_address=self.context["request"].META.get("REMOTE_ADDR"),
                **validated_data,
            )

            # 5. Agrupa itens por vendedor para criar SubOrders
            items_by_seller = {}
            for item in cart_items:
                seller = item.variant.product.seller
                if seller not in items_by_seller:
                    items_by_seller[seller] = []
                items_by_seller[seller].append(item)

            # 5a. Rateia o desconto do cupom por vendedor para conservar o valor:
            # a soma dos seller_amount + comissões precisa bater com o total pago.
            # - Cupom de loja: o desconto recai só sobre os itens daquela loja.
            # - Cupom da plataforma: rateado proporcionalmente ao subtotal de cada loja
            #   (a sobra de arredondamento vai para o último vendedor, fechando exato).
            seller_groups = list(items_by_seller.items())
            discount_dec = Decimal(str(discount or 0))
            discount_by_seller = {}
            if discount_dec > 0 and subtotal > 0:
                if coupon and coupon.seller:
                    for seller, items in seller_groups:
                        discount_by_seller[seller] = discount_dec if seller == coupon.seller else Decimal("0")
                else:
                    running = Decimal("0")
                    last_idx = len(seller_groups) - 1
                    for idx, (seller, items) in enumerate(seller_groups):
                        if idx == last_idx:
                            alloc = discount_dec - running
                        else:
                            s_sub = Decimal(str(sum(item.subtotal for item in items)))
                            alloc = (discount_dec * s_sub / Decimal(str(subtotal))).quantize(
                                Decimal("0.01"), rounding=ROUND_HALF_UP
                            )
                            running += alloc
                        discount_by_seller[seller] = alloc

            for seller, items in seller_groups:
                gross_subtotal = sum(item.subtotal for item in items)
                alloc = discount_by_seller.get(seller, Decimal("0"))
                # Subtotal efetivo = o que o cliente realmente pagou por esta loja.
                sub_subtotal = max(Decimal("0"), Decimal(str(gross_subtotal)) - alloc)
                # Frete deste lojista (cliente paga; o valor vai para o lojista
                # pagar a etiqueta no Melhor Envio). Comissão NÃO incide sobre frete.
                # Frete grátis: o cliente não paga e a loja não recebe frete (ela paga a etiqueta).
                sub_shipping = Decimal("0") if free_shipping else cart.seller_shipping_price(seller.id)
                commission = round(sub_subtotal * seller.commission_rate, 2)
                # Lojista recebe: (produto - comissão) + frete cheio.
                seller_amount = (sub_subtotal - commission) + sub_shipping

                sub_order = SubOrder.objects.create(
                    order=order,
                    seller=seller,
                    subtotal=sub_subtotal,
                    shipping=sub_shipping,
                    commission=commission,
                    seller_amount=seller_amount,
                )

                for item in items:
                    # Coleta os atributos da variante
                    attributes = {}
                    for attr_val in item.variant.attributes.all():
                        attributes[attr_val.attribute.name] = attr_val.value

                    # Cria o item do pedido
                    OrderItem.objects.create(
                        sub_order=sub_order,
                        variant=item.variant,
                        product_name=item.variant.product.name,
                        variant_sku=item.variant.sku,
                        variant_attributes=attributes,
                        quantity=item.quantity,
                        unit_price=item.variant.effective_price,
                        total=item.subtotal,
                    )

                    # Baixa atômica e condicional: só desconta se ainda houver unidades no banco
                    # AGORA (não no objeto lido antes). Duas compras simultâneas da mesma peça
                    # única: uma passa, a outra recebe 'esgotou' e o pedido inteiro é desfeito.
                    from django.db.models import F as _F
                    baixou = ProductVariant.objects.filter(
                        id=item.variant_id, stock__gte=item.quantity
                    ).update(stock=_F("stock") - item.quantity)
                    if not baixou:
                        raise serializers.ValidationError(
                            {"detail": f"{item.variant.product.name} acabou de esgotar. Atualize sua sacola."}
                        )

                    # Reserva estoque no Redis com TTL de 15 minutos (900s)
                    if redis_client:
                        try:
                            redis_client.setex(
                                f"stock_reserve:{order.id}:{item.variant.id}",
                                900,
                                item.quantity,
                            )
                        except Exception:
                            pass

            # 6. Atualiza data do carrinho para fins de analytics (carrinho já não é limpo imediatamente)
            cart.updated_at = timezone.now()
            cart.save(update_fields=["updated_at"])

        return order
