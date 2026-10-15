from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.assistant.context import catalog_products, system_prompt
from apps.assistant.gemini import AssistantUnavailable, ask

MAX_MESSAGES = 12
MAX_CONTENT_LENGTH = 800
MAX_PRODUCTS = 3

UNAVAILABLE_DETAIL = "Atendimento automático indisponível no momento. Fale com a gente pelo WhatsApp."


class ChatMessageSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=("user", "assistant"))
    content = serializers.CharField(max_length=MAX_CONTENT_LENGTH, trim_whitespace=True, allow_blank=False)


class ChatRequestSerializer(serializers.Serializer):
    messages = serializers.ListField(child=ChatMessageSerializer(), min_length=1, max_length=MAX_MESSAGES)

    def validate_messages(self, messages):
        if messages[-1]["role"] != "user":
            raise serializers.ValidationError("A última mensagem precisa ser do usuário.")
        return messages


def _cited_products(reply):
    """Produtos do catálogo cujo nome aparece na resposta (máx. 3), para virar card no chat."""
    if not reply:
        return []
    haystack = reply.casefold()
    cited = []
    for product in catalog_products():
        name = product.get("name") or ""
        if name and name.casefold() in haystack:
            cited.append(product)
            if len(cited) == MAX_PRODUCTS:
                break
    return cited


class ChatView(APIView):
    """POST /api/v1/assistant/chat/ — atendimento por IA, público e com limite por IP."""

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "assistant"

    def post(self, request, *args, **kwargs):
        serializer = ChatRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        gemini_messages = [
            {"role": "model" if m["role"] == "assistant" else "user", "text": m["content"]}
            for m in serializer.validated_data["messages"]
        ]
        try:
            reply = ask(system_prompt(), gemini_messages)
        except AssistantUnavailable:
            return Response({"detail": UNAVAILABLE_DETAIL}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        return Response({"reply": reply, "products": _cited_products(reply)})
