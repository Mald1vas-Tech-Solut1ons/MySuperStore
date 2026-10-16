

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
