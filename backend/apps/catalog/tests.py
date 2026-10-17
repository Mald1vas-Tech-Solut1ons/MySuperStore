

from unittest import mock as _mock

from django.core.files.base import ContentFile as _ContentFile
from django.test import TestCase as _TestCase


class ImageOptimizationLoopTest(_TestCase):
    """Regressão: re-salvar uma ProductImage não pode reenfileirar a otimização (loop com Cloudinary)."""

    @_mock.patch("apps.catalog.signals.optimize_product_image_task.delay")
    def test_so_enfileira_na_criacao(self, delay):
        from django.contrib.auth import get_user_model
        from apps.catalog.models import Category, Product, ProductImage
        from apps.sellers.models import Seller, SellerStatus

        user = get_user_model().objects.create(email="img@test.com", first_name="I", last_name="M")
        seller = Seller.objects.create(user=user, store_name="Loja Img", slug="loja-img", status=SellerStatus.APPROVED)
        product = Product.objects.create(seller=seller, category=Category.objects.create(name="C", slug="c-img"),
                                         name="P", slug="p-img", base_price="10.00", is_available=True)
        with self.captureOnCommitCallbacks(execute=True):
            img = ProductImage.objects.create(product=product, image=_ContentFile(b"x", name="a"), is_primary=True, order=0)
        self.assertEqual(delay.call_count, 1)
        with self.captureOnCommitCallbacks(execute=True):
            img.save(update_fields=["image"])
        self.assertEqual(delay.call_count, 1)


class ProductListHasVideoTest(_TestCase):
    """A vitrine precisa saber se a peça tem vídeo sem carregar o detalhe."""

    def test_listagem_expoe_has_video_sem_video_url(self):
        from django.contrib.auth import get_user_model
        from rest_framework.test import APIClient
        from apps.catalog.models import Category, Product
        from apps.sellers.models import Seller, SellerStatus

        user = get_user_model().objects.create(email="video@test.com", first_name="V", last_name="D")
        seller = Seller.objects.create(user=user, store_name="Loja Vídeo", slug="loja-video", status=SellerStatus.APPROVED)
        category = Category.objects.create(name="Macramê", slug="macrame-video")
        base = dict(seller=seller, category=category, base_price="10.00", is_available=True)
        Product.objects.create(name="Externo", slug="com-video-externo",
                               video_external="https://res.cloudinary.com/demo/video/upload/franja.mp4", **base)
        Product.objects.create(name="Arquivo", slug="com-video-arquivo", video="products/videos/franja.mp4", **base)
        Product.objects.create(name="Sem", slug="sem-video", video_external="", **base)

        response = APIClient().get("/api/v1/catalog/products/")
        self.assertEqual(response.status_code, 200)
        results = response.json()
        results = results.get("results", results)
        by_slug = {p["slug"]: p for p in results}
        self.assertTrue(by_slug["com-video-externo"]["has_video"])
        self.assertTrue(by_slug["com-video-arquivo"]["has_video"])
        self.assertFalse(by_slug["sem-video"]["has_video"])
        self.assertNotIn("video_url", by_slug["sem-video"])
