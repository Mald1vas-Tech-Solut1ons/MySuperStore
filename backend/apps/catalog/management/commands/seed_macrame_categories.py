from django.core.management.base import BaseCommand

from apps.catalog.macrame import ensure_macrame_categories
from apps.catalog.models import Category


class Command(BaseCommand):
    help = "Cria (ou completa) a árvore de categorias de peças de macramê. Idempotente."

    def handle(self, *args, **options):
        categories = ensure_macrame_categories(Category)
        for slug, category in categories.items():
            parent = category.parent.name if category.parent_id else "(raiz)"
            self.stdout.write(f"{category.name} [{slug}] ← {parent}")
        self.stdout.write(self.style.SUCCESS(f"{len(categories)} categorias de macramê garantidas."))
