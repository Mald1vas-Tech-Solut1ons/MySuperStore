import base64
import io
import shutil
import tempfile

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import TestCase, override_settings
from PIL import Image
from rest_framework.test import APIClient

User = get_user_model()

TMP_MEDIA = tempfile.mkdtemp(prefix="avatar-test-")
STORAGES_TESTE = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}


def png_bytes(size=(40, 30), color=(200, 30, 30)):
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, format="PNG")
    return buf.getvalue()


def data_url(raw: bytes, mime="image/png"):
    return f"data:{mime};base64," + base64.b64encode(raw).decode()


@override_settings(STORAGES=STORAGES_TESTE, MEDIA_ROOT=TMP_MEDIA, MEDIA_URL="/media/")
class AvatarEmArquivoTest(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TMP_MEDIA, ignore_errors=True)

    def setUp(self):
        self.user = User.objects.create(email="ana@test.com", first_name="Ana", last_name="S", is_active=True)
        self.c = APIClient()
        self.c.force_authenticate(self.user)

    def _patch_avatar(self, raw):
        f = SimpleUploadedFile("minha foto.png", raw, content_type="image/png")
        return self.c.patch("/api/v1/users/me/", {"avatar": f}, format="multipart")

    def test_upload_salva_arquivo_e_nao_grava_base64(self):
        r = self._patch_avatar(png_bytes())
        self.assertEqual(r.status_code, 200, r.data)
        self.user.refresh_from_db()
        self.assertTrue(self.user.avatar)
        self.assertIsNone(self.user.avatar_base64)
        self.assertTrue(self.user.avatar.name.startswith("avatars/"))
        self.assertIn(str(self.user.pk), self.user.avatar.name)
        self.assertFalse(r.data["avatar_url"].startswith("data:"))
        self.assertTrue(r.data["avatar_url"].endswith(self.user.avatar.name))

    def test_upload_novo_substitui_base64_legado(self):
        self.user.avatar_base64 = data_url(png_bytes())
        self.user.save()
        r = self._patch_avatar(png_bytes((50, 50)))
        self.assertEqual(r.status_code, 200, r.data)
        self.user.refresh_from_db()
        self.assertIsNone(self.user.avatar_base64)
        self.assertTrue(self.user.avatar)

    def test_arquivo_que_nao_e_imagem_e_recusado(self):
        f = SimpleUploadedFile("x.png", b"isto nao e uma imagem", content_type="image/png")
        r = self.c.patch("/api/v1/users/me/", {"avatar": f}, format="multipart")
        self.assertEqual(r.status_code, 400)
        self.assertIn("avatar", r.data)

    @override_settings(PRODUCT_PHOTO_MAX_BYTES=100)
    def test_foto_acima_do_limite_e_recusada(self):
        r = self._patch_avatar(png_bytes((400, 400)))
        self.assertEqual(r.status_code, 400)
        self.assertIn("avatar", r.data)
        self.user.refresh_from_db()
        self.assertFalse(self.user.avatar)

    def test_leitura_legado_ainda_devolve_o_base64(self):
        legado = data_url(png_bytes())
        self.user.avatar_base64 = legado
        self.user.save()
        r = self.c.get("/api/v1/users/me/")
        self.assertEqual(r.data["avatar_url"], legado)

    def test_sem_avatar_devolve_null(self):
        self.assertIsNone(self.c.get("/api/v1/users/me/").data["avatar_url"])


@override_settings(STORAGES=STORAGES_TESTE, MEDIA_ROOT=TMP_MEDIA, MEDIA_URL="/media/")
class MigrateAvatarsTest(TestCase):
    def setUp(self):
        grande = png_bytes((1600, 1200), (10, 120, 200))
        self.ok = User.objects.create(email="ok@test.com", first_name="O", last_name="K", avatar_base64=data_url(grande))
        self.ruim = User.objects.create(email="ruim@test.com", first_name="R", last_name="M",
                                        avatar_base64="data:image/png;base64,naoeumaimagem!!")
        self.sem = User.objects.create(email="sem@test.com", first_name="S", last_name="M")

    def _run(self, *args):
        out = io.StringIO()
        call_command("migrate_avatars", *args, stdout=out)
        return out.getvalue()

    def test_simulacao_nao_altera_nada(self):
        antes = User.objects.get(pk=self.ok.pk).avatar_base64
        saida = self._run()
        self.assertIn("SIMULAÇÃO", saida)
        self.ok.refresh_from_db()
        self.assertEqual(self.ok.avatar_base64, antes)
        self.assertFalse(self.ok.avatar)

    def test_apply_migra_reduz_e_limpa_base64(self):
        saida = self._run("--apply")
        self.assertIn("migrados=1", saida)
        self.ok.refresh_from_db()
        self.assertIsNone(self.ok.avatar_base64)
        self.assertTrue(self.ok.avatar.name.endswith(".webp"))
        img = Image.open(self.ok.avatar)
        self.assertLessEqual(max(img.size), 512)
        self.assertEqual(img.format, "WEBP")

    def test_imagem_invalida_e_mantida_sem_apagar(self):
        saida = self._run("--apply")
        self.assertIn("falhas=1", saida)
        self.ruim.refresh_from_db()
        self.assertEqual(self.ruim.avatar_base64, "data:image/png;base64,naoeumaimagem!!")
        self.assertFalse(self.ruim.avatar)

    def test_idempotente(self):
        self._run("--apply")
        segunda = self._run("--apply")
        self.assertIn("migrados=0", segunda)
        self.ok.refresh_from_db()
        self.assertTrue(self.ok.avatar)

    def test_usuario_com_arquivo_e_base64_nao_e_tocado(self):
        self.ok.avatar.save("ja-tem.png", SimpleUploadedFile("ja-tem.png", png_bytes()), save=True)
        User.objects.filter(pk=self.ok.pk).update(avatar_base64=data_url(png_bytes()))
        saida = self._run("--apply")
        self.assertIn("ignorados=1", saida)
        self.ok.refresh_from_db()
        self.assertIsNotNone(self.ok.avatar_base64)
