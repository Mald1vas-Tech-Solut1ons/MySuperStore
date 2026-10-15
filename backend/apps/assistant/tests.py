from unittest import mock

from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

from apps.assistant.gemini import AssistantUnavailable

URL = "/api/v1/assistant/chat/"
CATALOG = [{"slug": "bolsa-caracol", "name": "Bolsa Caracol", "price": 249.0, "image": None}]


@mock.patch("apps.assistant.views.system_prompt", return_value="SYS")
@mock.patch("apps.assistant.views.catalog_products", return_value=CATALOG)
class ChatViewTests(TestCase):
    def setUp(self):
        cache.clear()
        self.c = APIClient()

    def post(self, messages):
        return self.c.post(URL, {"messages": messages}, format="json")

    @mock.patch("apps.assistant.views.ask", return_value="Temos a Bolsa Caracol por R$ 249,00.")
    def test_resposta_com_produto_citado(self, ask, *_):
        r = self.post([{"role": "user", "content": "Oi"}, {"role": "assistant", "content": "Olá!"}, {"role": "user", "content": "Bolsas?"}])
        self.assertEqual(r.status_code, 200)
        self.assertEqual([p["slug"] for p in r.data["products"]], ["bolsa-caracol"])
        ask.assert_called_once_with("SYS", [{"role": "user", "text": "Oi"}, {"role": "model", "text": "Olá!"}, {"role": "user", "text": "Bolsas?"}])

    @mock.patch("apps.assistant.views.ask")
    def test_validacoes(self, ask, *_):
        self.assertEqual(self.post([{"role": "assistant", "content": "x"}]).status_code, 400)
        self.assertEqual(self.post([{"role": "user", "content": "a" * 801}]).status_code, 400)
        self.assertEqual(self.post([{"role": "user", "content": "oi"}] * 13).status_code, 400)
        ask.assert_not_called()

    @mock.patch("apps.assistant.views.ask", side_effect=AssistantUnavailable)
    def test_indisponivel_503(self, *_):
        self.assertEqual(self.post([{"role": "user", "content": "oi"}]).status_code, 503)
