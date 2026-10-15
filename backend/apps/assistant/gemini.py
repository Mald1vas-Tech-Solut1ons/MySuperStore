"""Cliente mínimo da API Gemini (generateContent) com fallback entre modelos.

A chave fica só no servidor (settings.GEMINI_API_KEY). Se um modelo estiver
sobrecarregado ou indisponível, tenta o próximo de settings.GEMINI_MODELS.
"""
import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

API = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


class AssistantUnavailable(Exception):
    """Sem chave configurada ou todos os modelos falharam."""


def ask(system: str, messages: list[dict]) -> str:
    key = getattr(settings, "GEMINI_API_KEY", "")
    if not key:
        raise AssistantUnavailable("GEMINI_API_KEY ausente")

    body = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [{"role": m["role"], "parts": [{"text": m["text"]}]} for m in messages],
        "generationConfig": {"temperature": 0.5, "maxOutputTokens": 1024},
    }
    for model in settings.GEMINI_MODELS:
        try:
            resp = requests.post(API.format(model=model), json=body, headers={"x-goog-api-key": key}, timeout=25)
            data = resp.json()
            if resp.status_code == 200:
                parts = data["candidates"][0]["content"]["parts"]
                text = "".join(p.get("text", "") for p in parts if not p.get("thought")).strip()
                if text:
                    return text
            logger.warning("Gemini %s falhou: %s %s", model, resp.status_code,
                           str((data.get("error") or {}).get("message", ""))[:160])
        except (requests.RequestException, ValueError, KeyError, IndexError) as exc:
            logger.warning("Gemini %s erro: %s", model, exc)
    raise AssistantUnavailable("todos os modelos falharam")
