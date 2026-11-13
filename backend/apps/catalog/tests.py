

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


class MacrameCategoriesTest(_TestCase):
    """Árvore de categorias de peças de macramê (migração 0013 + comando)."""

    def test_migracao_cria_arvore_sob_a_raiz(self):
        from apps.catalog.macrame import CHILDREN, ROOT_SLUG
        from apps.catalog.models import Category

        root = Category.objects.get(slug=ROOT_SLUG)
        self.assertIsNone(root.parent)
        children = set(root.children.values_list("slug", flat=True))
        self.assertEqual(children, {slug for _, slug, _ in CHILDREN})
        # As categorias pedidas pela lojista estão todas lá.
        for slug in ("bolsas", "calcados", "rasteirinhas", "moda-feminina", "moda-praia"):
            self.assertIn(slug, children)

    def test_ensure_e_idempotente_e_nao_renomeia_existente(self):
        from apps.catalog.macrame import ensure_macrame_categories
        from apps.catalog.models import Category

        Category.objects.filter(slug="bolsas").update(name="Minhas Bolsas", parent=None)
        antes = Category.objects.count()

        ensure_macrame_categories(Category)
        ensure_macrame_categories(Category)

        self.assertEqual(Category.objects.count(), antes)
        bolsas = Category.objects.get(slug="bolsas")
        self.assertEqual(bolsas.name, "Minhas Bolsas")  # nome ajustado no admin é preservado
        self.assertEqual(bolsas.parent.slug, "pecas-de-macrame")  # mas volta para debaixo da raiz

    def test_filtro_pela_raiz_traz_produtos_das_filhas(self):
        from django.contrib.auth import get_user_model
        from rest_framework.test import APIClient
        from apps.catalog.models import Category, Product
        from apps.sellers.models import Seller, SellerStatus

        user = get_user_model().objects.create(email="arvore@test.com", first_name="A", last_name="R")
        seller = Seller.objects.create(user=user, store_name="Loja Árvore", slug="loja-arvore", status=SellerStatus.APPROVED)
        Product.objects.create(seller=seller, category=Category.objects.get(slug="rasteirinhas"), name="Rasteira Sol",
                               slug="rasteira-sol", base_price="89.00", is_available=True)

        for slug in ("rasteirinhas", "pecas-de-macrame"):
            data = APIClient().get(f"/api/v1/catalog/products/?category={slug}").json()
            data = data.get("results", data)
            self.assertEqual([p["slug"] for p in data], ["rasteira-sol"], slug)

    def test_detalhe_do_lojista_devolve_o_id_da_categoria(self):
        from django.contrib.auth import get_user_model
        from rest_framework.test import APIClient
        from apps.catalog.models import Category, Product
        from apps.sellers.models import Seller, SellerStatus

        user = get_user_model().objects.create(email="edit@test.com", first_name="E", last_name="D")
        seller = Seller.objects.create(user=user, store_name="Loja Edit", slug="loja-edit", status=SellerStatus.APPROVED)
        categoria = Category.objects.get(slug="moda-praia")
        produto = Product.objects.create(seller=seller, category=categoria, name="Saída", slug="saida-praia",
                                         base_price="199.00", weight="0.350", length="30", width="22", height="6")

        client = APIClient()
        client.force_authenticate(user)
        response = client.get(f"/api/v1/sellers/me/products/{produto.id}/")
        self.assertEqual(response.status_code, 200, response.content)
        body = response.json()
        self.assertEqual(body["category"], str(categoria.id))
        self.assertEqual(float(body["weight"]), 0.35)
