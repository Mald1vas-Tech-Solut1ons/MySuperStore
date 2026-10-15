"""
Testes do fluxo financeiro do checkout.

Travam as duas invariantes críticas do caminho do dinheiro:
1. Conservação de valor: soma(seller_amount) + soma(comissões) == total pago,
   inclusive quando há cupom de desconto (rateado entre lojas).
2. Status de repasse correto: COMPLETED só quando há split nativo do Efí
   (lojista com efi_payee_code); caso contrário PENDING (dívida real).
"""
from datetime import timedelta
from decimal import Decimal
from unittest import mock

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIRequestFactory

from apps.carts.models import Cart, CartItem
from apps.catalog.models import Category, Product, ProductVariant
from apps.orders.models import Coupon, OrderStatus
from apps.orders.serializers import OrderCreateSerializer
from apps.payments.models import Payment, PaymentMethod, PaymentStatus, Payout, PayoutStatus
from apps.payments.processing import process_successful_payment
from apps.sellers.models import Seller, SellerStatus

User = get_user_model()

ADDRESS = {
    "address_recipient": "Fulano",
    "address_cep": "01001000",
    "address_logradouro": "Rua A",
    "address_numero": "100",
    "address_bairro": "Centro",
    "address_cidade": "Sao Paulo",
    "address_uf": "SP",
}


class FinancialFlowTest(TestCase):
    def setUp(self):
        self.buyer = User.objects.create(
            email="buyer@test.com", first_name="Buyer", last_name="X", is_active=True
        )
        u1 = User.objects.create(email="s1@test.com", first_name="S", last_name="1")
        u2 = User.objects.create(email="s2@test.com", first_name="S", last_name="2")
        # Lojista autorizado (tem payee_code -> split nativo) e não autorizado.
        self.seller_auth = Seller.objects.create(
            user=u1, store_name="Loja Auth", slug="loja-auth",
            status=SellerStatus.APPROVED, efi_payee_code="1234567-8",
        )
        self.seller_noauth = Seller.objects.create(
            user=u2, store_name="Loja NoAuth", slug="loja-noauth",
            status=SellerStatus.APPROVED, efi_payee_code="",
        )
        cat = Category.objects.create(name="Categoria", slug="categoria")

        self.v_auth = self._variant(self.seller_auth, cat, "Produto A", "p-a", Decimal("100.00"))
        self.v_noauth = self._variant(self.seller_noauth, cat, "Produto B", "p-b", Decimal("300.00"))

        self.cart = Cart.objects.create(user=self.buyer)
        CartItem.objects.create(cart=self.cart, variant=self.v_auth, quantity=1)
        CartItem.objects.create(cart=self.cart, variant=self.v_noauth, quantity=1)

    def _variant(self, seller, cat, name, slug, price):
        product = Product.objects.create(
            seller=seller, category=cat, name=name, slug=slug,
            base_price=price, is_available=True,
        )
        return ProductVariant.objects.create(
            product=product, sku=f"{slug}-sku", stock=50, is_active=True,
        )

    def _create_order(self, coupon_code=None):
        data = dict(ADDRESS)
        if coupon_code:
            data["coupon_code"] = coupon_code
        request = APIRequestFactory().post("/api/v1/orders/", data)
        request.user = self.buyer
        serializer = OrderCreateSerializer(data=data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        return serializer.save()

    def assert_conserves_value(self, order):
        subs = list(order.sub_orders.all())
        sum_seller = sum(s.seller_amount for s in subs)
        sum_comm = sum(s.commission for s in subs)
        sum_sub = sum(s.subtotal for s in subs)
        sum_ship = sum(s.shipping for s in subs)
        # Repasses + comissões == total pago pelo cliente.
        self.assertEqual(sum_seller + sum_comm, order.total)
        # Produtos (já com desconto) + frete == total.
        self.assertEqual(sum_sub + sum_ship, order.total)

    def test_conservacao_sem_cupom(self):
        order = self._create_order()
        self.assertEqual(order.total, Decimal("400.00"))
        self.assert_conserves_value(order)

    def test_conservacao_com_cupom_plataforma(self):
        Coupon.objects.create(
            code="GERAL10", discount_percentage=Decimal("10"),
            valid_from=timezone.now() - timedelta(days=1),
            valid_to=timezone.now() + timedelta(days=1), active=True,
        )
        order = self._create_order("GERAL10")
        # 10% de 400 = 40 de desconto -> total 360, rateado entre as duas lojas.
        self.assertEqual(order.total, Decimal("360.00"))
        self.assert_conserves_value(order)

    def test_frete_cliente_paga_vai_pro_lojista(self):
        # Cliente escolheu frete: R$20 na loja Auth, R$30 na loja NoAuth.
        self.cart.selected_shipping = {
            str(self.seller_auth.id): {"price": "20.00", "name": "PAC"},
            str(self.seller_noauth.id): {"price": "30.00", "name": "SEDEX"},
        }
        self.cart.save(update_fields=["selected_shipping"])
        order = self._create_order()
        # Produtos 400 + frete 50 = 450.
        self.assertEqual(order.shipping, Decimal("50.00"))
        self.assertEqual(order.total, Decimal("450.00"))
        self.assert_conserves_value(order)

        sub_auth = order.sub_orders.get(seller=self.seller_auth)
        self.assertEqual(sub_auth.shipping, Decimal("20.00"))
        # Comissão incide só sobre o produto (100), nunca sobre o frete.
        self.assertEqual(sub_auth.commission, Decimal("12.00"))
        # Lojista recebe (100 - 12) + 20 de frete = 108.
        self.assertEqual(sub_auth.seller_amount, Decimal("108.00"))

    def test_conservacao_com_cupom_de_loja(self):
        Coupon.objects.create(
            code="AUTH20", seller=self.seller_auth, discount_percentage=Decimal("20"),
            valid_from=timezone.now() - timedelta(days=1),
            valid_to=timezone.now() + timedelta(days=1), active=True,
        )
        order = self._create_order("AUTH20")
        # 20% só sobre os 100 da loja Auth = 20 de desconto -> total 380.
        self.assertEqual(order.total, Decimal("380.00"))
        self.assert_conserves_value(order)
        # A loja NoAuth não pode ter sido afetada pelo cupom da concorrente.
        sub_noauth = order.sub_orders.get(seller=self.seller_noauth)
        self.assertEqual(sub_noauth.subtotal, Decimal("300.00"))

    def test_status_repasse_por_split(self):
        order = self._create_order()
        Payment.objects.create(
            order=order, method=PaymentMethod.PIX, amount=order.total,
            status=PaymentStatus.PENDING,
        )
        processed = process_successful_payment(
            order, raw_response={"provider": "efi", "metadata": {"type": "pix"}}
        )
        self.assertTrue(processed)
        order.refresh_from_db()
        self.assertEqual(order.status, OrderStatus.CONFIRMED)

        payout_auth = Payout.objects.get(seller=self.seller_auth)
        payout_noauth = Payout.objects.get(seller=self.seller_noauth)
        # Lojista com payee_code -> Efí repassa direto -> COMPLETED.
        self.assertEqual(payout_auth.status, PayoutStatus.COMPLETED)
        self.assertIsNotNone(payout_auth.processed_at)
        # Sem payee_code -> dinheiro na conta master -> PENDING (não fingir pago).
        self.assertEqual(payout_noauth.status, PayoutStatus.PENDING)
        self.assertIsNone(payout_noauth.processed_at)


class PayoutSettlementTest(TestCase):
    """Liquidação de repasse via Pix Envio (lojista sem split nativo)."""

    def setUp(self):
        from apps.orders.models import Order, SubOrder
        self.seller_user = User.objects.create(email="sell@test.com", first_name="S", last_name="L")
        self.seller = Seller.objects.create(
            user=self.seller_user, store_name="Loja PIX", slug="loja-pix",
            status=SellerStatus.APPROVED, efi_payee_code="", pix_key="loja@pix.com",
        )
        self.order = Order.objects.create(
            user=None, order_number="20260626-9999",
            subtotal=Decimal("100.00"), total=Decimal("100.00"),
            address_recipient="x", address_cep="01001000", address_logradouro="r",
            address_numero="1", address_bairro="c", address_cidade="SP", address_uf="SP",
        )
        self.sub = SubOrder.objects.create(
            order=self.order, seller=self.seller,
            subtotal=Decimal("100.00"), commission=Decimal("12.00"), seller_amount=Decimal("88.00"),
        )
        self.payout = Payout.objects.create(
            sub_order=self.sub, seller=self.seller, amount=Decimal("88.00"),
            status=PayoutStatus.PENDING,
        )

    @mock.patch("apps.payments.services.EfiPixService.is_configured", return_value=True)
    @mock.patch("apps.payments.services.EfiPixService.send_to_seller")
    def test_liquidacao_sucesso(self, mock_send, _cfg):
        from apps.payments.processing import settle_payout
        mock_send.return_value = {"e2eId": "E123456789", "status": "EM_PROCESSAMENTO"}
        ok = settle_payout(self.payout)
        self.assertTrue(ok)
        self.payout.refresh_from_db()
        self.assertEqual(self.payout.status, PayoutStatus.COMPLETED)
        self.assertEqual(self.payout.mp_payout_id, "E123456789")
        self.assertIsNotNone(self.payout.processed_at)
        # Idempotência: enviou exatamente uma vez com idEnvio = id do payout.
        self.assertEqual(mock_send.call_count, 1)
        self.assertEqual(mock_send.call_args.kwargs["id_envio"], str(self.payout.id))

    @mock.patch("apps.payments.services.EfiPixService.is_configured", return_value=True)
    @mock.patch("apps.payments.services.EfiPixService.send_to_seller")
    def test_escopo_desabilitado_mantem_pendente(self, mock_send, _cfg):
        from apps.payments.processing import settle_payout
        # Resposta de erro (string) como o Efí devolve quando falta escopo Pix Envio.
        mock_send.return_value = "{ 'error': 'insufficient_scope' }"
        ok = settle_payout(self.payout)
        self.assertFalse(ok)
        self.payout.refresh_from_db()
        self.assertEqual(self.payout.status, PayoutStatus.PENDING)
        self.assertIsNone(self.payout.processed_at)

    @mock.patch("apps.payments.services.EfiPixService.is_configured", return_value=True)
    @mock.patch("apps.payments.services.EfiPixService.send_to_seller")
    def test_sem_chave_pix_nao_envia(self, mock_send, _cfg):
        from apps.payments.processing import settle_payout
        self.seller.pix_key = ""
        self.seller.save(update_fields=["pix_key"])
        ok = settle_payout(self.payout)
        self.assertFalse(ok)
        mock_send.assert_not_called()


class PixRefundTest(TestCase):
    """Estorno (devolução) de pagamento PIX via pix_devolution."""

    def setUp(self):
        from apps.orders.models import Order, OrderStatus
        self.buyer = User.objects.create(email="b@t.com", first_name="B", last_name="X", is_active=True)
        self.order = Order.objects.create(
            user=self.buyer, order_number="20260626-7777",
            subtotal=Decimal("50.00"), total=Decimal("50.00"), status=OrderStatus.CONFIRMED,
            address_recipient="x", address_cep="01001000", address_logradouro="r",
            address_numero="1", address_bairro="c", address_cidade="SP", address_uf="SP",
        )
        self.payment = Payment.objects.create(
            order=self.order, method=PaymentMethod.PIX, amount=Decimal("50.00"),
            status=PaymentStatus.APPROVED, efi_txid="txid123",
        )

    @mock.patch("apps.payments.services.EfiPixService.is_configured", return_value=True)
    @mock.patch("apps.payments.services.EfiPixService.refund_pix")
    def test_estorno_pix_integral(self, mock_refund, _cfg):
        from rest_framework.test import APIClient
        from apps.orders.models import OrderStatus
        mock_refund.return_value = {"status": "DEVOLVIDO", "id": "dev1"}

        client = APIClient()
        client.force_authenticate(user=self.buyer)
        resp = client.post(f"/api/v1/payments/{self.payment.id}/refund/", {}, format="json")
        self.assertEqual(resp.status_code, 200, resp.content)

        # Acionou a devolução no Efí com o txid do pagamento.
        mock_refund.assert_called_once()
        self.assertEqual(mock_refund.call_args.args[0], "txid123")

        self.payment.refresh_from_db()
        self.order.refresh_from_db()
        self.assertEqual(self.payment.status, PaymentStatus.REFUNDED)
        self.assertEqual(self.order.status, OrderStatus.REFUNDED)


class HouseStoreTest(TestCase):
    """Loja da casa (receives_in_master=True): recebe direto na conta master da plataforma."""

    def setUp(self):
        self.buyer = User.objects.create(
            email="buyer-house@test.com", first_name="Buyer", last_name="H", is_active=True
        )
        u_house = User.objects.create(email="house@test.com", first_name="H", last_name="S")
        u_auth = User.objects.create(email="auth-house@test.com", first_name="S", last_name="2")
        # Loja da casa: tem payee_code, mas recebe direto na conta master.
        self.house = Seller.objects.create(
            user=u_house, store_name="Loja da Casa", slug="loja-da-casa",
            status=SellerStatus.APPROVED, efi_payee_code="7654321-0",
            pix_key="casa@pix.com", receives_in_master=True,
        )
        self.seller_auth = Seller.objects.create(
            user=u_auth, store_name="Loja Auth House", slug="loja-auth-house",
            status=SellerStatus.APPROVED, efi_payee_code="1234567-8",
        )
        cat = Category.objects.create(name="Categoria Casa", slug="categoria-casa")

        self.v_house = self._variant(self.house, cat, "Produto Casa", "p-casa", Decimal("100.00"))
        self.v_auth = self._variant(self.seller_auth, cat, "Produto Auth", "p-auth", Decimal("300.00"))

        self.cart = Cart.objects.create(user=self.buyer)
        CartItem.objects.create(cart=self.cart, variant=self.v_house, quantity=1)
        CartItem.objects.create(cart=self.cart, variant=self.v_auth, quantity=1)

    def _variant(self, seller, cat, name, slug, price):
        product = Product.objects.create(
            seller=seller, category=cat, name=name, slug=slug,
            base_price=price, is_available=True,
        )
        return ProductVariant.objects.create(
            product=product, sku=f"{slug}-sku", stock=50, is_active=True,
        )

    def _create_order(self):
        data = dict(ADDRESS)
        request = APIRequestFactory().post("/api/v1/orders/", data)
        request.user = self.buyer
        serializer = OrderCreateSerializer(data=data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        return serializer.save()

    def test_loja_da_casa_nao_e_autorizada(self):
        # (a) payee_code presente, mas receives_in_master desautoriza o split.
        self.assertFalse(self.house.efi_authorized)
        self.assertTrue(self.seller_auth.efi_authorized)

    def test_payout_loja_da_casa_nasce_completo(self):
        # (b) sem payee_code e sem pix_key: mesmo assim nasce COMPLETED.
        self.house.efi_payee_code = ""
        self.house.pix_key = ""
        self.house.save(update_fields=["efi_payee_code", "pix_key"])

        order = self._create_order()
        Payment.objects.create(
            order=order, method=PaymentMethod.PIX, amount=order.total,
            status=PaymentStatus.PENDING,
        )
        processed = process_successful_payment(
            order, raw_response={"provider": "efi", "metadata": {"type": "pix"}}
        )
        self.assertTrue(processed)

        payout_house = Payout.objects.get(seller=self.house)
        self.assertEqual(payout_house.status, PayoutStatus.COMPLETED)
        self.assertIsNotNone(payout_house.processed_at)

    @mock.patch("apps.payments.services.EfiPixService.is_configured", return_value=True)
    @mock.patch("apps.payments.services.EfiPixService.send_to_seller")
    def test_liquidacao_pix_nao_envia_para_loja_da_casa(self, mock_send, _cfg):
        # (c) PENDING e com pix_key, mas é loja da casa: não dispara Pix Envio.
        from apps.orders.models import Order, SubOrder
        from apps.payments.processing import settle_payout

        order = Order.objects.create(
            user=None, order_number="20260626-8888",
            subtotal=Decimal("100.00"), total=Decimal("100.00"),
            address_recipient="x", address_cep="01001000", address_logradouro="r",
            address_numero="1", address_bairro="c", address_cidade="SP", address_uf="SP",
        )
        sub = SubOrder.objects.create(
            order=order, seller=self.house,
            subtotal=Decimal("100.00"), commission=Decimal("12.00"), seller_amount=Decimal("88.00"),
        )
        payout = Payout.objects.create(
            sub_order=sub, seller=self.house, amount=Decimal("88.00"),
            status=PayoutStatus.PENDING,
        )

        self.assertFalse(settle_payout(payout))
        mock_send.assert_not_called()

    def test_splits_cartao_ignoram_loja_da_casa(self):
        # (d) loja da casa tem payee_code, mas fica fora dos splits do cartão.
        from apps.payments.services import EfiCardService

        order = self._create_order()
        splits = list(EfiCardService._build_splits(order))
        self.assertEqual(len(splits), 1)
        self.assertFalse(any("7654321-0" in str(s) for s in splits))


class FeaturedStoreTest(TestCase):
    """Vitrine da home: ordem de destaque definida pelo admin, sem deploy."""

    def test_destaque_ordena_e_filtra(self):
        from rest_framework.test import APIClient

        mk = lambda slug, rank: Seller.objects.create(
            user=User.objects.create(email=f"{slug}@t.com", first_name="x", last_name="y"),
            store_name=slug, slug=slug, status=SellerStatus.APPROVED, featured_rank=rank,
        )
        mk("sem-destaque", None)
        mk("segunda", 2)
        mk("principal", 1)

        client = APIClient()
        res = client.get("/api/v1/sellers/")
        rows = res.data["results"] if isinstance(res.data, dict) else res.data
        self.assertEqual([r["slug"] for r in rows][:2], ["principal", "segunda"])

        res = client.get("/api/v1/sellers/?featured=1")
        rows = res.data["results"] if isinstance(res.data, dict) else res.data
        self.assertEqual([r["slug"] for r in rows], ["principal", "segunda"])


class SecurityHardeningTest(TestCase):
    """Webhook Pix com prova de origem, isolamento de pagamentos e catálogo só de lojas aprovadas."""

    def setUp(self):
        from rest_framework.test import APIClient
        from apps.orders.models import Order

        self.client_api = APIClient()
        self.user_a = User.objects.create(email="a@sec.com", first_name="A", last_name="A")
        self.user_b = User.objects.create(email="b@sec.com", first_name="B", last_name="B")
        self.order = Order.objects.create(
            user=self.user_a, order_number="20261015-0001",
            subtotal=Decimal("100.00"), total=Decimal("100.00"),
            address_recipient="x", address_cep="01001000", address_logradouro="r",
            address_numero="1", address_bairro="c", address_cidade="SP", address_uf="SP",
        )
        self.payment = Payment.objects.create(
            order=self.order, method=PaymentMethod.PIX, amount=Decimal("100.00"),
            status=PaymentStatus.PENDING, efi_txid="TX1",
        )

    def _hook(self, qs, valor="100.00"):
        return self.client_api.post(
            f"/api/v1/payments/efi-webhook/{qs}", {"pix": [{"txid": "TX1", "valor": valor}]}, format="json"
        )

    @override_settings(EFI_WEBHOOK_SECRET="s3cr3t")
    def test_webhook_hmac_invalido_recusa(self):
        self.assertEqual(self._hook("?hmac=errado").status_code, 401)
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, PaymentStatus.PENDING)

    @override_settings(EFI_WEBHOOK_SECRET="s3cr3t")
    @mock.patch("apps.payments.views.dispatch_post_payment_tasks")
    def test_webhook_hmac_valido_confirma(self, _dispatch):
        self.assertEqual(self._hook("?hmac=s3cr3t&ignorar=/pix").status_code, 200)
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, PaymentStatus.APPROVED)

    @override_settings(EFI_WEBHOOK_SECRET="s3cr3t")
    def test_webhook_valor_menor_nao_confirma(self):
        self.assertEqual(self._hook("?hmac=s3cr3t", valor="1.00").status_code, 200)
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, PaymentStatus.PENDING)

    @override_settings(EFI_WEBHOOK_SECRET="", DEBUG=False)
    def test_webhook_sem_segredo_em_producao_fecha(self):
        self.assertEqual(self._hook("").status_code, 503)

    def test_usuario_nao_lista_pagamento_de_outro(self):
        self.client_api.force_authenticate(self.user_b)
        res = self.client_api.get("/api/v1/payments/")
        rows = res.data["results"] if isinstance(res.data, dict) else res.data
        self.assertNotIn(str(self.payment.id), [str(r["id"]) for r in rows])

    def test_catalogo_oculta_loja_suspensa(self):
        cat = Category.objects.create(name="Cat Sec", slug="cat-sec")
        for slug, st in (("ok", SellerStatus.APPROVED), ("susp", SellerStatus.SUSPENDED)):
            s = Seller.objects.create(
                user=User.objects.create(email=f"{slug}@sec.com", first_name="s", last_name="s"),
                store_name=f"Loja {slug}", slug=f"loja-{slug}", status=st,
            )
            Product.objects.create(seller=s, category=cat, name=f"P {slug}", slug=f"p-{slug}",
                                   base_price=Decimal("10.00"), is_available=True)
        res = self.client_api.get("/api/v1/catalog/products/")
        rows = res.data["results"] if isinstance(res.data, dict) else res.data
        slugs = [r["slug"] for r in rows]
        self.assertIn("p-ok", slugs)
        self.assertNotIn("p-susp", slugs)
