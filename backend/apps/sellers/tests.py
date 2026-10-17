import importlib.util
import io
import shutil
import tempfile
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace
from unittest import mock, skipUnless

import cloudinary
import cloudinary.exceptions
import cloudinary.utils
import yaml
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from django.core.management import call_command
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management.base import CommandError
from django.test import SimpleTestCase, TestCase, override_settings
from django.utils import timezone
from PIL import Image
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


# -- Upload de mídia do painel sem estourar a memória da API (VM de 1 GB) --------

CLOUDINARY_STORAGES = {
    "default": {"BACKEND": "cloudinary_storage.storage.MediaCloudinaryStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}


def _jpeg(size=(40, 30), exif_orientation=None):
    buf = io.BytesIO()
    img = Image.new("RGB", size, (200, 100, 50))
    kwargs = {}
    if exif_orientation:
        exif = Image.Exif()
        exif[0x0112] = exif_orientation
        kwargs["exif"] = exif
    img.save(buf, "JPEG", **kwargs)
    return buf.getvalue()


class _SellerMediaBase(TestCase):
    def setUp(self):
        from django.contrib.auth import get_user_model
        from apps.catalog.models import Category, Product
        from apps.sellers.models import Seller, SellerStatus

        self.media_root = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.media_root, ignore_errors=True)
        media = override_settings(MEDIA_ROOT=self.media_root)
        media.enable()
        self.addCleanup(media.disable)

        User = get_user_model()
        cat = Category.objects.create(name="C", slug="c-media")
        self.user = User.objects.create(email="midia@test.com", first_name="M", last_name="L", is_active=True)
        seller = Seller.objects.create(user=self.user, store_name="Loja", slug="loja-midia", status=SellerStatus.APPROVED)
        self.product = Product.objects.create(seller=seller, category=cat, name="P", slug="p-midia",
                                              base_price="10.00", is_available=True)
        other = User.objects.create(email="outro@test.com", first_name="O", last_name="T", is_active=True)
        other_seller = Seller.objects.create(user=other, store_name="Outra", slug="outra", status=SellerStatus.APPROVED)
        self.other_product = Product.objects.create(seller=other_seller, category=cat, name="Q", slug="q-midia",
                                                    base_price="10.00", is_available=True)
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def url(self, suffix, product=None):
        return f"/api/v1/sellers/me/products/{(product or self.product).pk}/{suffix}"


class _CloudinaryOn:
    """Liga o storage do Cloudinary com credenciais falsas (nenhuma chamada de rede)."""

    def setUp(self):
        super().setUp()
        storages = override_settings(STORAGES=CLOUDINARY_STORAGES)
        storages.enable()
        self.addCleanup(storages.disable)
        cloudinary.config(cloud_name="demo", api_key="key123", api_secret="secret456")
        self.addCleanup(cloudinary.reset_config)


class VideoSignatureTest(_CloudinaryOn, _SellerMediaBase):
    def test_assina_upload_com_public_id_fixo_do_produto(self):
        r = self.client.post(self.url("video/signature/"))
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertTrue(data["direct"])
        params = data["params"]
        self.assertRegex(params["public_id"], rf"^products/videos/{self.product.pk}-[0-9a-f]{{12}}$")
        self.assertEqual(params["allowed_formats"], "mp4,mov,webm")
        self.assertEqual(data["signature"], cloudinary.utils.api_sign_request(params, "secret456"))
        self.assertEqual(data["api_key"], "key123")
        self.assertIn("/demo/video/upload", data["upload_url"])
        self.assertNotIn("secret456", r.content.decode())

    def test_nao_assina_produto_de_outra_loja(self):
        r = self.client.post(self.url("video/signature/", self.other_product))
        self.assertEqual(r.status_code, 404)

    def test_sem_cloudinary_indica_multipart(self):
        with override_settings(STORAGES={**CLOUDINARY_STORAGES, "default": {
                "BACKEND": "django.core.files.storage.FileSystemStorage"}}):
            r = self.client.post(self.url("video/signature/"))
        self.assertEqual(r.json(), {"direct": False})


class VideoAttachTest(_CloudinaryOn, _SellerMediaBase):
    def _pid(self, product=None):
        from apps.sellers.media import new_video_public_id
        return new_video_public_id(product or self.product)

    def _resource(self, pid, **extra):
        return {"public_id": pid, "bytes": 10 * 1024 * 1024, "format": "mp4",
                "secure_url": f"https://res.cloudinary.com/demo/video/upload/v1/{pid}.mp4", **extra}

    @mock.patch("cloudinary.uploader.destroy")
    @mock.patch("cloudinary.api.resource")
    def test_confirma_video_enviado_direto(self, resource, destroy):
        pid = self._pid()
        resource.return_value = self._resource(pid)
        r = self.client.post(self.url("video/"), {"public_id": pid}, format="json")
        self.assertEqual(r.status_code, 201)
        resource.assert_called_once_with(pid, resource_type="video")
        self.product.refresh_from_db()
        self.assertEqual(self.product.video_external, resource.return_value["secure_url"])
        self.assertEqual(r.json()["video_url"], self.product.video_external)
        destroy.assert_not_called()

    @mock.patch("cloudinary.api.resource")
    def test_recusa_public_id_de_outro_produto(self, resource):
        r = self.client.post(self.url("video/"), {"public_id": self._pid(self.other_product)}, format="json")
        self.assertEqual(r.status_code, 400)
        resource.assert_not_called()

    @mock.patch("cloudinary.uploader.destroy")
    @mock.patch("cloudinary.api.resource")
    def test_video_grande_demais_e_apagado(self, resource, destroy):
        pid = self._pid()
        resource.return_value = self._resource(pid, bytes=60 * 1024 * 1024)
        r = self.client.post(self.url("video/"), {"public_id": pid}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("50 MB", r.json()["detail"])
        destroy.assert_called_once_with(pid, resource_type="video", invalidate=True)
        self.product.refresh_from_db()
        self.assertIsNone(self.product.video_external)

    @mock.patch("cloudinary.api.resource", side_effect=cloudinary.exceptions.NotFound("x"))
    def test_video_inexistente(self, resource):
        r = self.client.post(self.url("video/"), {"public_id": self._pid()}, format="json")
        self.assertEqual(r.status_code, 400)

    @mock.patch("cloudinary.uploader.destroy")
    @mock.patch("cloudinary.api.resource")
    def test_troca_apaga_video_anterior_gerenciado(self, resource, destroy):
        old = self._pid()
        self.product.video_external = f"https://res.cloudinary.com/demo/video/upload/v9/{old}.mp4"
        self.product.save(update_fields=["video_external"])
        new = self._pid()
        resource.return_value = self._resource(new)
        r = self.client.post(self.url("video/"), {"public_id": new}, format="json")
        self.assertEqual(r.status_code, 201)
        destroy.assert_called_once_with(old, resource_type="video", invalidate=True)

    @mock.patch("cloudinary.uploader.destroy")
    def test_remover_apaga_no_cloudinary(self, destroy):
        old = self._pid()
        self.product.video_external = f"https://res.cloudinary.com/demo/video/upload/v9/{old}.mp4"
        self.product.save(update_fields=["video_external"])
        self.assertEqual(self.client.delete(self.url("video/")).status_code, 204)
        destroy.assert_called_once_with(old, resource_type="video", invalidate=True)
        self.product.refresh_from_db()
        self.assertIsNone(self.product.video_external)

    @mock.patch("cloudinary.uploader.upload")
    @mock.patch("cloudinary.uploader.upload_large")
    def test_multipart_legado_sobe_em_pedacos(self, upload_large, upload):
        upload_large.return_value = {"secure_url": "https://res.cloudinary.com/demo/video/upload/v1/x.mp4"}
        video = SimpleUploadedFile("clip.mp4", b"\x00" * 2048, content_type="video/mp4")
        r = self.client.post(self.url("video/"), {"video": video}, format="multipart")
        self.assertEqual(r.status_code, 201)
        upload.assert_not_called()  # upload() lê o arquivo inteiro na memória
        self.assertEqual(upload_large.call_args.kwargs["chunk_size"], 6 * 1024 * 1024)
        self.assertEqual(upload_large.call_args.kwargs["resource_type"], "video")

    @mock.patch("cloudinary.uploader.upload_large", side_effect=RuntimeError("cloudinary fora"))
    def test_falha_no_cloudinary_nao_cai_no_storage_de_imagem(self, upload_large):
        video = SimpleUploadedFile("clip.mp4", b"\x00" * 2048, content_type="video/mp4")
        r = self.client.post(self.url("video/"), {"video": video}, format="multipart")
        self.assertEqual(r.status_code, 502)
        self.product.refresh_from_db()
        self.assertFalse(self.product.video)


class VideoWithoutCloudinaryTest(_SellerMediaBase):
    def test_multipart_grava_no_storage_local(self):
        video = SimpleUploadedFile("clip.mp4", b"\x00" * 2048, content_type="video/mp4")
        r = self.client.post(self.url("video/"), {"video": video}, format="multipart")
        self.assertEqual(r.status_code, 201)
        self.product.refresh_from_db()
        self.assertTrue(self.product.video.name.startswith("products/videos/"))

    def test_public_id_sem_cloudinary_e_recusado(self):
        r = self.client.post(self.url("video/"), {"public_id": "products/videos/x"}, format="json")
        self.assertEqual(r.status_code, 400)


@mock.patch("apps.catalog.signals.optimize_product_image_task.delay")
class PhotoLimitsTest(_SellerMediaBase):
    def _post(self, data):
        return self.client.post(self.url("images/"), {"image": SimpleUploadedFile("f.jpg", data, "image/jpeg"),
                                                      "order": "0"}, format="multipart")

    def test_foto_normal_passa(self, delay):
        self.assertEqual(self._post(_jpeg()).status_code, 201)

    @override_settings(PRODUCT_PHOTO_MAX_BYTES=100)
    def test_foto_acima_do_limite_de_bytes(self, delay):
        r = self._post(_jpeg())
        self.assertEqual(r.status_code, 400)
        self.assertIn("10 MB", r.json()["image"][0])

    @override_settings(PRODUCT_PHOTO_MAX_PIXELS=1000)
    def test_foto_acima_do_limite_de_pixels(self, delay):
        r = self._post(_jpeg(size=(50, 50)))
        self.assertEqual(r.status_code, 400)
        self.assertIn("megapixels", r.json()["image"][0])


class OptimizeImageTaskTest(_SellerMediaBase):
    @mock.patch("apps.catalog.signals.optimize_product_image_task.delay")
    def test_reduz_e_respeita_orientacao_exif(self, delay):
        from django.core.files.base import ContentFile
        from apps.catalog.models import ProductImage
        from apps.catalog.tasks import optimize_product_image_task

        # Foto "deitada" 1600x1200 com EXIF orientation=6 (girar 90°): de pé fica 1200x1600.
        img = ProductImage.objects.create(product=self.product, image=ContentFile(
            _jpeg(size=(1600, 1200), exif_orientation=6), name="foto.jpg"), is_primary=True, order=0)
        optimize_product_image_task(str(img.id))
        img.refresh_from_db()
        with img.image.open("rb") as f:
            out = Image.open(f)
            out.load()
        self.assertEqual(out.format, "WEBP")
        self.assertEqual(out.size, (900, 1200))


class DaphnePatchTest(SimpleTestCase):
    """O Twisted não pode fazer parse do multipart (13x o upload em RAM) e corpo grande leva 413."""

    def _request(self):
        from daphne.http_protocol import WebRequest
        from twisted.web.test.requesthelper import DummyChannel
        from config.daphne_patches import patch_daphne

        patch_daphne()
        channel = DummyChannel()
        channel.factory = SimpleNamespace(server=mock.Mock())
        return WebRequest(channel), channel

    def _multipart(self):
        body = (b"--b\r\nContent-Disposition: form-data; name=\"video\"; filename=\"a.mp4\"\r\n"
                b"Content-Type: video/mp4\r\n\r\n" + b"\x00" * 1000 + b"\r\n--b--\r\n")
        return body

    def test_nao_faz_parse_do_multipart(self):
        req, _ = self._request()
        self.assertFalse(req._parsePOSTFormSubmission)
        body = self._multipart()
        req.requestHeaders.setRawHeaders(b"content-type", [b"multipart/form-data; boundary=b"])
        req.requestHeaders.setRawHeaders(b"content-length", [str(len(body)).encode()])
        req.gotLength(len(body))
        req.handleContentChunk(body)
        with mock.patch.object(type(req), "process") as process, \
                mock.patch("twisted.web.http._getMultiPartArgs") as parse:
            req.requestReceived(b"POST", b"/api/v1/x/", b"HTTP/1.1")
        parse.assert_not_called()
        process.assert_called_once()
        self.assertEqual(req.args, {})

    @override_settings(MAX_REQUEST_BODY_BYTES=1000)
    def test_corpo_acima_do_teto_recebe_413_sem_chamar_o_app(self):
        req, channel = self._request()
        req.gotLength(5000)
        req.handleContentChunk(b"\x00" * 5000)
        with mock.patch.object(type(req), "process") as process:
            req.requestReceived(b"POST", b"/api/v1/x/", b"HTTP/1.1")
        process.assert_not_called()
        self.assertTrue(channel.transport.written.getvalue().startswith(b"HTTP/1.1 413"))

    @override_settings(MAX_REQUEST_BODY_BYTES=1000)
    def test_corpo_chunked_acima_do_teto_recebe_413(self):
        req, channel = self._request()
        req.gotLength(None)
        req.handleContentChunk(b"\x00" * 600)
        req.handleContentChunk(b"\x00" * 600)
        self.assertTrue(channel.transport.written.getvalue().startswith(b"HTTP/1.1 413"))
