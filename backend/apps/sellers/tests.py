"""Upload de mídia do painel do lojista sem estourar a memória da API (VM de 1 GB)."""
import io
import shutil
import tempfile
from types import SimpleNamespace
from unittest import mock

import cloudinary
import cloudinary.exceptions
import cloudinary.utils
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase, TestCase, override_settings
from PIL import Image
from rest_framework.test import APIClient

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
