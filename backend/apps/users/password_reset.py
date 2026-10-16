"""
Recuperação de senha por e-mail.

Usa o gerador de tokens do Django (default_token_generator): o token é atrelado ao
hash da senha atual e ao último login, então vira inválido assim que a senha muda,
e expira em settings.PASSWORD_RESET_TIMEOUT. Nada é guardado no banco.
"""
import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import EmailMultiAlternatives
from django.utils.encoding import force_bytes, force_str
from django.utils.html import escape
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode

logger = logging.getLogger(__name__)


def build_reset_link(user) -> str:
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    return f"{settings.FRONTEND_URL.rstrip('/')}/redefinir-senha?uid={uid}&token={token}"


def user_from_uid(uid: str):
    """Usuário ativo do uid, ou None se o uid for inválido."""
    try:
        pk = force_str(urlsafe_base64_decode(uid))
        return get_user_model().objects.get(pk=pk, is_active=True)
    except (TypeError, ValueError, OverflowError, get_user_model().DoesNotExist):
        return None


def send_password_reset_email(user) -> bool:
    """Envia o link de nova senha. Retorna True se enviou (erros são logados, nunca expostos)."""
    link = build_reset_link(user)
    first_name = escape((getattr(user, "first_name", "") or "").strip() or "olá")
    hours = settings.PASSWORD_RESET_TIMEOUT // 3600

    subject = "Crie uma nova senha — Ateliê Eli Trassi"
    text_body = (
        f"Oi, {first_name}!\n\n"
        "Recebemos um pedido para criar uma nova senha na sua conta.\n"
        f"Use o link abaixo (válido por {hours} horas):\n\n{link}\n\n"
        "Se não foi você, ignore este e-mail: sua senha continua a mesma.\n\n"
        "Ateliê Eli Trassi Macramê"
    )
    html_body = f"""<!DOCTYPE html>
<html lang="pt-BR"><body style="margin:0;background:#F4EDE3;font-family:Georgia,'Times New Roman',serif;color:#1F1A17">
  <div style="max-width:520px;margin:32px auto;background:#ffffff;border-radius:24px;padding:40px 36px;border:1px solid #E8DCCA">
    <p style="margin:0 0 4px;font-size:22px">Ateliê Eli Trassi</p>
    <p style="margin:0 0 28px;font-size:11px;letter-spacing:4px;color:#8a7f76;font-family:Arial,sans-serif">MACRAMÊ</p>
    <p style="font-size:26px;margin:0 0 12px">Crie uma nova senha</p>
    <p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#4a423c">
      Oi, {first_name}! Recebemos um pedido para criar uma nova senha na sua conta.
      O link vale por {hours} horas.
    </p>
    <p style="margin:28px 0">
      <a href="{link}" style="display:inline-block;background:#1F1A17;color:#F4EDE3;text-decoration:none;
         padding:14px 28px;border-radius:999px;font-family:Arial,sans-serif;font-size:15px">Criar nova senha</a>
    </p>
    <p style="font-family:Arial,sans-serif;font-size:13px;line-height:1.6;color:#8a7f76">
      Se não foi você, ignore este e-mail: sua senha continua a mesma.
    </p>
  </div>
</body></html>"""
    try:
        msg = EmailMultiAlternatives(subject, text_body, settings.DEFAULT_FROM_EMAIL, [user.email])
        msg.attach_alternative(html_body, "text/html")
        msg.send()
        return True
    except Exception as exc:  # noqa: BLE001 — falha de SMTP não pode vazar para o cliente
        logger.error("Falha ao enviar e-mail de nova senha para o usuário %s: %s", user.pk, exc)
        return False
