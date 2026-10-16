import uuid
from django.conf import settings
from django.db import models
from django.db.models import Sum


class Cart(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # Usuário logado ou sessão anônima (ambos podem coexistir)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name="cart"
    )
    session_key = models.CharField(max_length=40, blank=True)
    coupon = models.ForeignKey("orders.Coupon", on_delete=models.SET_NULL, null=True, blank=True)
    
    # Logística
    destination_cep = models.CharField(max_length=9, blank=True)
    # Formato: {"seller_id": {"id": 1, "company": "Correios", "name": "PAC", "price": "18.50", "delivery_time": 5}}
    selected_shipping = models.JSONField(default=dict, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "carrinho"
        verbose_name_plural = "carrinhos"

    def __str__(self):
        return f"Carrinho de {self.user or self.session_key}"

    @property
    def subtotal(self):
        return sum(item.subtotal for item in self.items.all())

    @property
    def total(self):
        return self.products_total + self.shipping_total

    @property
    def products_total(self):
        """Produtos já com o desconto do cupom (sem frete)."""
        base_total = self.subtotal
        if not self.coupon or not self.coupon.active:
            return base_total
            
        discount = 0
        if self.coupon.seller:
            # Coupon only applies to items from this seller
            seller_items_total = sum(item.subtotal for item in self.items.all() if item.variant.product.seller == self.coupon.seller)
            if self.coupon.discount_percentage:
                discount = seller_items_total * (self.coupon.discount_percentage / 100)
            elif self.coupon.discount_amount:
                discount = min(self.coupon.discount_amount, seller_items_total)
        else:
            # Global coupon
            if self.coupon.discount_percentage:
                discount = base_total * (self.coupon.discount_percentage / 100)
            elif self.coupon.discount_amount:
                discount = min(self.coupon.discount_amount, base_total)
                
        return max(base_total - discount, 0)

    @property
    def free_shipping(self):
        """Frete grátis quando os produtos com desconto atingem settings.FREE_SHIPPING_MIN."""
        from decimal import Decimal
        from django.conf import settings
        return Decimal(str(self.products_total)) >= settings.FREE_SHIPPING_MIN

    @property
    def quoted_shipping_total(self):
        """Frete cotado (Melhor Envio), antes do frete grátis — só das lojas com peça na sacola.

        selected_shipping pode guardar cotações antigas de lojas que já saíram do carrinho;
        somar tudo cobrava frete fantasma (ex.: R$ 53,79 de uma loja sem item na sacola).
        """
        from decimal import Decimal
        sellers_in_cart = {str(s) for s in self.items.values_list("variant__product__seller_id", flat=True)}
        total = Decimal("0.00")
        for seller_id, seller_data in (self.selected_shipping or {}).items():
            if seller_id in sellers_in_cart and "price" in seller_data:
                total += Decimal(str(seller_data["price"]))
        return total

    @property
    def shipping_total(self):
        """Frete cobrado do cliente: zero quando há frete grátis (a loja paga a etiqueta)."""
        from decimal import Decimal
        return Decimal("0.00") if self.free_shipping else self.quoted_shipping_total

    @property
    def item_count(self):
        return self.items.aggregate(count=Sum("quantity"))["count"] or 0


class CartItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name="items")
    variant = models.ForeignKey("catalog.ProductVariant", on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1)

    class Meta:
        verbose_name = "item do carrinho"
        verbose_name_plural = "itens do carrinho"
        unique_together = [("cart", "variant")]

    def __str__(self):
        return f"{self.quantity}x {self.variant}"

    @property
    def subtotal(self):
        return self.variant.effective_price * self.quantity
