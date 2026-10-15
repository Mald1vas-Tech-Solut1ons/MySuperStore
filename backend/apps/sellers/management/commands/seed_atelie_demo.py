"""Dados de demonstração do Ateliê Eli Trassi para desenvolvimento local (só com DEBUG)."""
from decimal import Decimal
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files import File
from django.core.management.base import BaseCommand, CommandError

from apps.catalog.models import Category, Product, ProductImage, ProductStatus, ProductVariant
from apps.sellers.models import Seller, SellerStatus

USER_EMAIL = "eli@atelie.local"
SELLER_SLUG = "atelie-eli-trassi"
BRAND_DIR = Path(settings.BASE_DIR).parent / "frontend" / "public" / "brand" / "atelie"

CATEGORIES = [("Bolsas", "bolsas"), ("Chapéus", "chapeus"), ("Calçados", "calcados"), ("Casa", "casa")]

PRODUCTS = [
    ("Bolsa Caracol", "bolsa-caracol", "249.00", "caracol-dourada.webp",
     "Bolsa de macramê em formato de concha, alça trançada e ferragens douradas. Feita à mão, nó a nó."),
    ("Bolsa Caracol Prata", "bolsa-caracol-prata", "249.00", "caracol-prata.webp",
     "A nossa Bolsa Caracol com ferragens prateadas: macramê cru trabalhado à mão e alça trançada."),
    ("Bolsa Boho Café", "bolsa-boho-cafe", "279.00", "boho-cafe.webp",
     "Bolsa boho em tom café, alça longa trançada e borla com contas de madeira. Leve e versátil."),
    ("Bolsa Boho Off-white", "bolsa-boho-offwhite", "289.00", "boho-offwhite.webp",
     "Bolsa boho off-white em macramê, alça de couro e borla com contas de madeira."),
    ("Bolsa Boho Oliva", "bolsa-boho-oliva", "259.00", "boho-oliva-produto.webp",
     "Bolsa boho em verde oliva, alça trançada e contas de madeira. Também sob encomenda em outras cores."),
]


class Command(BaseCommand):
    help = "Popula o banco com a loja de demonstração do Ateliê Eli Trassi (somente DEBUG)."

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("seed só em desenvolvimento")

        user, _ = get_user_model().objects.get_or_create(
            email=USER_EMAIL, defaults={"first_name": "Eli", "last_name": "Trassi", "role": "seller", "is_active": True}
        )
        user.set_unusable_password()
        user.save()

        seller, _ = Seller.objects.update_or_create(
            slug=SELLER_SLUG,
            defaults={
                "user": user,
                "store_name": "Ateliê Eli Trassi Macramê",
                "description": "Macramê feito à mão, nó a nó, na Vila Galvão em Guarulhos.",
                "status": SellerStatus.APPROVED,
                "receives_in_master": True,
                "featured_rank": 1,
                "commission_rate": Decimal("0"),
                "origin_cep": "07071000",
            },
        )

        cats = {}
        for order, (name, slug) in enumerate(CATEGORIES):
            cats[slug], _ = Category.objects.update_or_create(
                slug=slug, defaults={"name": name, "is_active": True, "order": order}
            )

        for name, slug, price, image, description in PRODUCTS:
            product, _ = Product.objects.update_or_create(
                slug=slug,
                defaults={
                    "seller": seller, "category": cats["bolsas"], "name": name, "description": description,
                    "base_price": Decimal(price), "is_available": True, "approval_status": ProductStatus.APPROVED,
                },
            )
            ProductVariant.objects.update_or_create(
                sku=f"{slug}-un", defaults={"product": product, "price": None, "stock": 3, "is_active": True}
            )
            source = BRAND_DIR / image
            if not product.images.exists() and source.exists():
                with source.open("rb") as fh:
                    ProductImage.objects.create(product=product, image=File(fh, name=image), is_primary=True, order=0)

        self.stdout.write(self.style.SUCCESS(f"Seed ok: {seller.store_name} com {len(PRODUCTS)} peças."))
