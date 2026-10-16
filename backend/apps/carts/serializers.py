from rest_framework import serializers
from apps.catalog.models import ProductVariant
from apps.catalog.serializers import ProductVariantSerializer
from .models import Cart, CartItem


class CartItemSerializer(serializers.ModelSerializer):
    variant = ProductVariantSerializer(read_only=True)
    subtotal = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = CartItem
        fields = ["id", "variant", "quantity", "subtotal"]


class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)
    subtotal = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    shipping_total = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    free_shipping = serializers.BooleanField(read_only=True)
    free_shipping_min = serializers.SerializerMethodField()
    total = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    item_count = serializers.IntegerField(read_only=True)
    coupon_code = serializers.CharField(source="coupon.code", read_only=True, default=None)
    coupon_discount_percentage = serializers.DecimalField(
        source="coupon.discount_percentage", max_digits=5, decimal_places=2, read_only=True, default=None
    )
    coupon_discount_amount = serializers.DecimalField(
        source="coupon.discount_amount", max_digits=10, decimal_places=2, read_only=True, default=None
    )

    class Meta:
        model = Cart
        fields = [
            "id", "items", "subtotal", "shipping_total", "free_shipping", "free_shipping_min", "total", "item_count", 
            "coupon_code", "coupon_discount_percentage", "coupon_discount_amount",
            "destination_cep", "selected_shipping"
        ]

class ApplyCouponSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=50)


class AddToCartSerializer(serializers.Serializer):
    variant_id = serializers.UUIDField()
    quantity = serializers.IntegerField(default=1, min_value=1)

    def validate_variant_id(self, value):
        try:
            variant = ProductVariant.objects.get(id=value, is_active=True)
        except ProductVariant.DoesNotExist:
            raise serializers.ValidationError("Variante do produto não encontrada ou inativa.")
        return value

    def validate(self, data):
        variant = ProductVariant.objects.get(id=data["variant_id"])
        quantity = data["quantity"]
        if variant.stock < quantity:
            raise serializers.ValidationError(
                f"Estoque insuficiente. Apenas {variant.stock} unidades disponíveis."
            )
        return data

class ShippingQuoteSerializer(serializers.Serializer):
    destination_cep = serializers.CharField(max_length=9)

class ShippingSelectSerializer(serializers.Serializer):
    # Formato esperado: {"seller_id": {"id": 1, "company": "Correios", "name": "PAC", "price": "18.50", "delivery_time": 5}}
    selected_shipping = serializers.JSONField()

def _free_shipping_min(_obj):
    from django.conf import settings
    return str(settings.FREE_SHIPPING_MIN)


CartSerializer.get_free_shipping_min = staticmethod(_free_shipping_min)
