from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core import mail
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.test import APIClient
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend", FRONTEND_URL="https://loja.test")
class PasswordResetTest(TestCase):
    def setUp(self):
        cache.clear()
        self.c = APIClient()
        self.user = User.objects.create(email="cliente@test.com", first_name="Ana", last_name="S", is_active=True)
        self.user.set_password("senha-antiga-123")
        self.user.save()

    def _link_parts(self):
        return urlsafe_base64_encode(force_bytes(self.user.pk)), default_token_generator.make_token(self.user)

    def test_pedido_envia_link_e_nao_revela_email(self):
        r1 = self.c.post("/api/v1/auth/password-reset/", {"email": "CLIENTE@test.com"}, format="json")
        r2 = self.c.post("/api/v1/auth/password-reset/", {"email": "naoexiste@test.com"}, format="json")
        self.assertEqual((r1.status_code, r2.status_code), (200, 200))
        self.assertEqual(r1.data, r2.data)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("https://loja.test/redefinir-senha?uid=", mail.outbox[0].body)

    def test_confirmacao_troca_senha_uma_vez_e_derruba_sessoes(self):
        RefreshToken.for_user(self.user)  # sessão aberta
        uid, token = self._link_parts()
        r = self.c.post("/api/v1/auth/password-reset/confirm/",
                        {"uid": uid, "token": token, "new_password": "NovaSenha!Forte2026"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("NovaSenha!Forte2026"))
        self.assertEqual(BlacklistedToken.objects.filter(token__user=self.user).count(), 1)
        again = self.c.post("/api/v1/auth/password-reset/confirm/",
                            {"uid": uid, "token": token, "new_password": "OutraSenha!Forte2026"}, format="json")
        self.assertEqual(again.status_code, 400)

    def test_senha_fraca_recusada(self):
        uid, token = self._link_parts()
        r = self.c.post("/api/v1/auth/password-reset/confirm/",
                        {"uid": uid, "token": token, "new_password": "123"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("new_password", r.data)

    def test_uid_adulterado_nao_quebra(self):
        r = self.c.post("/api/v1/auth/password-reset/confirm/",
                        {"uid": "MQ", "token": "x-y", "new_password": "NovaSenha!Forte2026"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_token_invalido(self):
        uid, _ = self._link_parts()
        r = self.c.post("/api/v1/auth/password-reset/confirm/",
                        {"uid": uid, "token": "x-y", "new_password": "NovaSenha!Forte2026"}, format="json")
        self.assertEqual(r.status_code, 400)
