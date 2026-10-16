import importlib.util
import io
from decimal import Decimal
from pathlib import Path
from unittest import mock, skipUnless

import yaml
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.assistant.context import system_prompt
from apps.sellers.models import Seller
from apps.users.password_reset import send_password_reset_email

User = get_user_model()
APPLY = "/api/v1/sellers/apply/"
CANDIDATURA = {"store_name": "Loja da Ana", "efi_payee_code": "abc123", "origin_cep": "01001000"}
BOOTSTRAP = ["--email", "dona@loja.test", "--store-name", "Loja Teste", "--slug", "loja-teste", "--origin-cep", "07071-000"]
REPO = Path(settings.BASE_DIR).parent


def criar_usuario(email="ana@test.com", **extra):
    dados = {"first_name": "Ana", "last_name": "S", "is_active": True, "email_verified_at": timezone.now(), **extra}
    return User.objects.create(email=email, **dados)


class CandidaturaLojistaTest(TestCase):
    def setUp(self):
        self.c = APIClient()
        self.c.force_authenticate(criar_usuario())

    @override_settings(STORE_MODE="single")
    def test_loja_unica_bloqueia_candidatura(self):
        r = self.c.post(APPLY, CANDIDATURA, format="json")
        self.assertEqual(r.status_code, 403)
        self.assertEqual(r.data["code"], "single_store")
        self.assertFalse(Seller.objects.exists())

    @override_settings(STORE_MODE="marketplace")
    def test_marketplace_aceita_candidatura(self):
        r = self.c.post(APPLY, CANDIDATURA, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(Seller.objects.get().status, "approved")

    @override_settings(STORE_MODE="single")
    def test_staff_passa_da_trava(self):
        self.c.force_authenticate(criar_usuario(email="staff@test.com", is_staff=True))
        self.assertEqual(self.c.post(APPLY, CANDIDATURA, format="json").status_code, 201)


class BootstrapStoreTest(TestCase):
    def rodar(self, *extra):
        call_command("bootstrap_store", *BOOTSTRAP, *extra, stdout=io.StringIO())

    def test_cria_dona_e_loja_da_casa(self):
        self.rodar()
        user = User.objects.get(email="dona@loja.test")
        self.assertTrue(user.is_active)
        self.assertIsNotNone(user.email_verified_at)
        self.assertFalse(user.has_usable_password())
        self.assertEqual(user.role, "seller")
        seller = Seller.objects.get(user=user)
        self.assertEqual(seller.status, "approved")
        self.assertTrue(seller.receives_in_master)
        self.assertEqual(seller.featured_rank, 1)
        self.assertEqual(seller.commission_rate, Decimal("0"))
        self.assertEqual(seller.origin_cep, "07071000")

    def test_idempotente(self):
        self.rodar()
        self.rodar()
        self.assertEqual(User.objects.filter(email="dona@loja.test").count(), 1)
        self.assertEqual(Seller.objects.count(), 1)

    def test_admin(self):
        self.rodar("--admin")
        user = User.objects.get(email="dona@loja.test")
        self.assertEqual((user.role, user.is_staff, user.is_superuser), ("admin", True, True))

    def test_slug_de_outra_conta(self):
        Seller.objects.create(user=criar_usuario(email="outra@test.com"), store_name="Outra", slug="loja-teste", status="approved")
        with self.assertRaises(CommandError):
            self.rodar()


@mock.patch("apps.assistant.context.catalog_products", return_value=[])
class MarcaNoBackendTest(TestCase):
    def setUp(self):
        cache.clear()

    def test_prompt_padrao_e_o_do_atelie(self, _):
        self.assertTrue(system_prompt().startswith(
            "Você é a assistente virtual do Ateliê Eli Trassi Macramê, ateliê de peças em macramê feitas à mão "
            "na Vila Galvão, Guarulhos-SP, que envia para todo o Brasil. Você atende clientes no site."
        ))

    @override_settings(STORE_FULL_NAME="Loja Teste Cerâmica", STORE_ABOUT="ateliê de cerâmica em Campinas-SP")
    def test_prompt_com_marca_da_loja(self, _):
        self.assertTrue(system_prompt().startswith(
            "Você é a assistente virtual do Loja Teste Cerâmica, ateliê de cerâmica em Campinas-SP. Você atende clientes no site."
        ))

    @override_settings(STORE_NAME="Loja Teste", EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
                       FRONTEND_URL="https://loja.test")
    def test_email_de_nova_senha_com_marca_da_loja(self, _):
        self.assertTrue(send_password_reset_email(criar_usuario(email="cliente@test.com")))
        self.assertEqual(mail.outbox[0].subject, "Crie uma nova senha — Loja Teste")
        self.assertIn("Loja Teste", mail.outbox[0].alternatives[0][0])


@skipUnless((REPO / "scripts" / "new_store_env.py").exists(), "script fora da imagem")
class GeradorDeEnvTest(TestCase):
    def setUp(self):
        spec = importlib.util.spec_from_file_location("new_store_env", REPO / "scripts" / "new_store_env.py")
        self.mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.mod)
        self.cfg = yaml.safe_load((REPO / "deploy" / "store.example.yaml").read_text(encoding="utf-8"))

    def test_yaml_de_exemplo(self):
        front, back, deploy = self.mod.build(self.cfg)
        self.assertEqual(front["NEXT_PUBLIC_STORE_MODE"], "single")
        self.assertEqual(front["NEXT_PUBLIC_BRAND_NAV"], "Canecas=canecas|Pratos=pratos")
        self.assertEqual(front["NEXT_PUBLIC_COLOR_PRIMARY"], "2F5D62")  # sem "#": no .env, "#" vira comentário
        self.assertEqual(front["NEXT_PUBLIC_API_URL"], "https://api.loja-teste.example.com/api/v1")
        self.assertNotIn("NEXT_PUBLIC_LEGAL_NAME", front)  # vazio no YAML = usa o padrão
        self.assertEqual(back["STORE_MODE"], "single")
        self.assertEqual(back["PLATFORM_COMMISSION_RATE"], "0")
        self.assertEqual(back["SHIPPING_MODE"], "flat")
        self.assertEqual(back["CORS_ALLOWED_ORIGINS"], "https://loja-teste.vercel.app")
        self.assertIn(back["POSTGRES_PASSWORD"], back["DATABASE_URL"])
        self.assertEqual(deploy, {"API_DOMAIN": "api.loja-teste.example.com"})

    def test_valor_com_cerquilha_vai_entre_aspas_no_frontend(self):
        self.assertEqual(self.mod.env_line("A", "Loja #1", quote=True), "A='Loja #1'\n")
        self.assertEqual(self.mod.env_line("A", "Loja #1", quote=False), "A=Loja #1\n")

    def test_keep_preserva_segredos(self):
        kept = {"DJANGO_SECRET_KEY": "k", "POSTGRES_PASSWORD": "p", "EFI_WEBHOOK_SECRET": "w"}
        _, back, _ = self.mod.build(self.cfg, kept)
        self.assertEqual([back[k] for k in kept], ["k", "p", "w"])

    def test_valida_yaml(self):
        self.cfg["store"]["colors"]["bg"] = "azul"
        self.cfg["domains"]["api"] = "http://inseguro"
        with self.assertRaises(SystemExit):
            self.mod.build(self.cfg)
