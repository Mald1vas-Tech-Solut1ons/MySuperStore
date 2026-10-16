"""Importa/atualiza o catálogo de uma loja a partir de um manifest JSON + pasta de imagens.

Uso: python manage.py import_catalog <manifest.json> <pasta_imagens> [--dry]
Manifest: {"seller_slug": "...", "products": [{"slug","name","category_slug","description","price",
"stock","available","images": [...], "variants": [{"attribute","value","stock"}]}]}
Idempotente: atualiza por slug, não duplica imagens e desativa variantes que saíram do manifest.
"""
import json
import os
from decimal import Decimal

from django.core.files import File
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils.text import slugify

from apps.catalog.models import Attribute, AttributeValue, Category, Product, ProductImage, ProductStatus, ProductVariant
from apps.sellers.models import Seller

CATEGORY_NAMES = {"bolsas": "Bolsas", "acessorios": "Acessórios", "chapeus": "Chapéus", "calcados": "Calçados", "casa": "Casa"}


class Command(BaseCommand):
    help = "Importa catálogo a partir de um manifest JSON."

    def add_arguments(self, parser):
        parser.add_argument("manifest", type=str)
        parser.add_argument("images_dir", type=str)
        parser.add_argument("--dry", action="store_true", help="Apenas mostra o que seria feito.")

    def handle(self, *args, **options):
        try:
            with open(options["manifest"], encoding="utf-8") as f:
                manifest = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError) as exc:
            raise CommandError(f"Manifest inválido: {exc}")
        if not isinstance(manifest, dict) or not manifest.get("seller_slug") or not isinstance(manifest.get("products"), list):
            raise CommandError("Manifest deve conter 'seller_slug' e uma lista 'products'.")
        try:
            seller = Seller.objects.get(slug=manifest["seller_slug"])
        except Seller.DoesNotExist:
            raise CommandError(f"Seller não encontrado: {manifest['seller_slug']}")

        for item in manifest["products"]:
            if options["dry"]:
                exists = Product.objects.filter(slug=item["slug"]).exists()
                self.stdout.write(f"[dry] {item['slug']}: {'atualizado' if exists else 'criado'}")
                continue
            with transaction.atomic():
                self._import_product(item, options["images_dir"], seller)

    def _import_product(self, item, images_dir, seller):
        slug = item["slug"]
        cat_slug = item["category_slug"]
        category, _ = Category.objects.get_or_create(
            slug=cat_slug,
            defaults={"name": CATEGORY_NAMES.get(cat_slug, cat_slug.capitalize()), "description": "", "order": 0, "is_active": True},
        )
        product, created = Product.objects.update_or_create(
            slug=slug,
            defaults={
                "seller": seller,
                "category": category,
                "name": item["name"],
                "description": item.get("description") or "",
                "base_price": Decimal(str(item["price"])),
                "is_available": bool(item.get("available", False)),
                "approval_status": ProductStatus.APPROVED,
            },
        )

        variants = item.get("variants") or []
        skus = set()
        if variants:
            for v in variants:
                value = str(v.get("value") or "")
                sku = f"{slug}-{slugify(value)}"
                skus.add(sku)
                variant, _ = ProductVariant.objects.update_or_create(
                    sku=sku, defaults={"product": product, "stock": int(v.get("stock", 0) or 0), "is_active": True}
                )
                if v.get("attribute"):
                    attr, _ = Attribute.objects.get_or_create(name=v["attribute"])
                    attr_value, _ = AttributeValue.objects.get_or_create(attribute=attr, value=value)
                    variant.attributes.set([attr_value])
                else:
                    variant.attributes.clear()
        else:
            sku = f"{slug}-un"
            skus.add(sku)
            variant, _ = ProductVariant.objects.update_or_create(
                sku=sku, defaults={"product": product, "stock": int(item.get("stock", 0) or 0), "is_active": True}
            )
            variant.attributes.clear()
        ProductVariant.objects.filter(product=product).exclude(sku__in=skus).update(is_active=False)

        created_images = 0
        if not product.images.exists():
            for i, filename in enumerate(item.get("images") or []):
                path = os.path.join(images_dir, filename)
                if not os.path.exists(path):
                    raise CommandError(f"Imagem não encontrada: {path}")
                with open(path, "rb") as f:
                    ProductImage.objects.create(product=product, image=File(f, name=filename), order=i, is_primary=(i == 0))
                created_images += 1

        self.stdout.write(
            f"{slug}: {'criado' if created else 'atualizado'}, {len(skus)} variante(s), {created_images} imagem(ns)"
        )
