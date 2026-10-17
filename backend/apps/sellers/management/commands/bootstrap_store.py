from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify

from apps.sellers.models import Seller, SellerStatus


class Command(BaseCommand):
    """Cria (ou atualiza) a dona e a loja principal de uma instalação nova.

    A conta nasce ativa e SEM senha utilizável: a dona cria a própria senha pelo
    "Esqueci minha senha" do site. A loja nasce aprovada, recebendo direto na conta
    Efí master da instalação (sem split nem repasse), em destaque na home e sem comissão.
    Idempotente: rodar de novo só ajusta o que estiver diferente.
    """

    help = "Cria a dona e a loja principal de uma instalação nova (idempotente)."

    def add_arguments(self, parser):
        parser.add_argument("--email", required=True, help="E-mail da dona da loja.")
        parser.add_argument("--store-name", required=True, help='Nome da loja (ex.: "Ateliê Eli Trassi Macramê").')
        parser.add_argument("--slug", help="Slug da loja (padrão: gerado do nome).")
        parser.add_argument("--origin-cep", default="", help="CEP de origem dos envios (só dígitos).")
        parser.add_argument("--first-name", default="", help="Nome da dona (opcional).")
        parser.add_argument("--admin", action="store_true", help="Dá acesso ao painel /admin (admin + superusuária).")

    def handle(self, *args, **options):
        email = options["email"].strip().lower()
        store_name = options["store_name"].strip()
        slug = (options["slug"] or slugify(store_name)).strip()
        cep = "".join(c for c in options["origin_cep"] if c.isdigit())
        if not email or "@" not in email:
            raise CommandError("--email inválido.")
        if not store_name or not slug:
            raise CommandError("--store-name/--slug não podem ficar vazios.")
        if cep and len(cep) != 8:
            raise CommandError("--origin-cep deve ter 8 dígitos.")

        User = get_user_model()
        with transaction.atomic():
            user = User.objects.filter(email__iexact=email).first()
            created_user = user is None
            if created_user:
                user = User(email=email, first_name=options["first_name"] or store_name.split()[0], last_name="")
                user.set_unusable_password()
            if not user.is_active:
                user.is_active = True
            if not user.email_verified_at:
                user.email_verified_at = timezone.now()
            if options["admin"]:
                user.role = "admin"
                user.is_staff = True
                user.is_superuser = True
            elif user.role != "admin":
                user.role = "seller"
            user.save()

            other = Seller.objects.filter(slug=slug).exclude(user=user).first()
            if other:
                raise CommandError(f'O slug "{slug}" já pertence a outra conta ({other.user.email}).')
            if Seller.objects.filter(store_name=store_name).exclude(user=user).exists():
                raise CommandError(f'O nome "{store_name}" já está em uso por outra loja.')

            seller, created_seller = Seller.objects.update_or_create(
                user=user,
                defaults={
                    "store_name": store_name,
                    "slug": slug,
                    "status": SellerStatus.APPROVED,
                    "receives_in_master": True,
                    "featured_rank": 1,
                    "commission_rate": Decimal("0"),
                    **({"origin_cep": cep} if cep else {}),
                },
            )

        self.stdout.write(self.style.SUCCESS(
            f"{'Criada' if created_user else 'Atualizada'} a conta {user.email} (papel: {user.role}); "
            f"loja {seller.store_name} · slug={seller.slug} {'criada' if created_seller else 'atualizada'}."
        ))
        if created_user:
            self.stdout.write('A dona define a senha em "Esqueci minha senha" no site.')
