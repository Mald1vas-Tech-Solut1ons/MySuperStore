from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.sellers.models import Seller


class Command(BaseCommand):
    """Marca ou desmarca uma loja como "loja da casa" e define seu destaque na home.

    "Loja da casa" = recebe direto na conta Efí master da plataforma
    (sem split nem Pix Envio). featured_rank = ordem de destaque na home
    (1 = principal).
    """

    help = (
        'Marca/desmarca uma loja como "loja da casa" (recebe direto na conta '
        "Efí master, sem split nem Pix Envio) e define featured_rank (1 = principal)."
    )

    def add_arguments(self, parser):
        parser.add_argument("slug", help="Slug do Seller.")
        parser.add_argument("--featured", type=int, default=None, help="Define featured_rank (1 = principal).")
        parser.add_argument("--commission", type=Decimal, default=None, help='Define commission_rate (ex.: "0" ou "0.12").')
        parser.add_argument("--off", action="store_true", help="Desliga: receives_in_master=False e featured_rank=None.")
        parser.add_argument("--dry", action="store_true", help="Só mostra o antes → depois, sem salvar.")

    def handle(self, *args, **options):
        slug = options["slug"]
        featured = options["featured"]
        commission = options["commission"]

        seller = Seller.objects.filter(slug=slug).select_related("user").first()
        if seller is None:
            existing = list(Seller.objects.order_by("slug").values_list("slug", flat=True)[:20])
            raise CommandError(
                f'Seller com slug "{slug}" não encontrado. '
                f"Slugs existentes (até 20): {', '.join(existing) or '(nenhum)'}"
            )
        if commission is not None and not (Decimal("0") <= commission <= Decimal("1")):
            raise CommandError(f"--commission deve estar entre 0 e 1 (recebido: {commission}).")

        self.stdout.write(f"{seller.store_name} · slug={seller.slug} · status={seller.status} · dono={seller.user.email}")

        if options["off"]:
            desired = {"receives_in_master": False, "featured_rank": None}
        else:
            desired = {"receives_in_master": True}
            if featured is not None:
                desired["featured_rank"] = featured
            if commission is not None:
                desired["commission_rate"] = commission

        changes = [(f, getattr(seller, f), v) for f, v in desired.items() if getattr(seller, f) != v]
        if not changes:
            self.stdout.write("Nenhuma alteração a fazer.")
            return

        if options["dry"]:
            for field, old, new in changes:
                self.stdout.write(f"[dry] {field}: {old} → {new}")
            return

        with transaction.atomic():
            for field, _, new in changes:
                setattr(seller, field, new)
            seller.save(update_fields=[f for f, _, _ in changes])

        for field, old, new in changes:
            self.stdout.write(self.style.SUCCESS(f"{field}: {old} → {new}"))
