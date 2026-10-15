import json
import logging
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.utils import timezone
from asgiref.sync import sync_to_async

logger = logging.getLogger(__name__)

# --- WEB PUSH CORE ---

def send_web_push(user, title, message, url="/"):
    """
    Envia uma Notificação Push nativa para todas as subscrições (aparelhos) do usuário.
    """
    try:
        from pywebpush import webpush, WebPushException
    except ImportError:
        logger.warning("pywebpush não instalado. Ignorando web push.")
        return

    # VAPID Keys: Devem ser geradas com `npx web-push generate-vapid-keys`
    # Se não houver VAPID keys no settings, não manda
    vapid_private_key = getattr(settings, "VAPID_PRIVATE_KEY", None)
    vapid_admin_email = getattr(settings, "VAPID_ADMIN_EMAIL", "mailto:admin@mysuperstore.com")

    if not vapid_private_key:
        logger.warning("VAPID_PRIVATE_KEY não configurada. Ignorando web push.")
        return

    subscriptions = user.push_subscriptions.all()
    payload = json.dumps({
        "title": title,
        "body": message,
        "url": url,
        "icon": f"{settings.FRONTEND_URL.rstrip('/')}/icon-192x192.png",
        "badge": f"{settings.FRONTEND_URL.rstrip('/')}/badge-72x72.png",
    })

    for sub in subscriptions:
        sub_info = {
            "endpoint": sub.endpoint,
            "keys": {
                "p256dh": sub.p256dh,
                "auth": sub.auth
            }
        }
        try:
            webpush(
                subscription_info=sub_info,
                data=payload,
                vapid_private_key=vapid_private_key,
                vapid_claims={"sub": vapid_admin_email}
            )
        except WebPushException as ex:
            logger.error("Web Push Error: %s", repr(ex))
            # Se for erro 410 (Gone) ou 404, o usuário cancelou a inscrição. Removemos do DB.
            if ex.response and ex.response.status_code in (410, 404):
                sub.delete()

# --- E-MAIL TEMPLATES COMUNS ---

def get_base_html_template(title, content):
    """Shell HTML premium e à prova de clientes de e-mail (layout em tabela, estilos inline)."""
    logo_url = f"{settings.FRONTEND_URL.rstrip('/')}/email-logo.png"
    year = timezone.now().year
    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="dark">
    <title>{title}</title>
    <style>
        .cta-button {{ display:inline-block; background:linear-gradient(90deg,#E6B53C 0%,#B38F25 100%); color:#0C0B11 !important; text-decoration:none; padding:15px 34px; border-radius:12px; font-weight:800; font-size:15px; }}
        a {{ color:#E6B53C; }}
        @media (max-width:620px) {{ .px {{ padding-left:24px !important; padding-right:24px !important; }} }}
    </style>
</head>
<body style="margin:0; padding:0; background-color:#050510; -webkit-font-smoothing:antialiased;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#050510; padding:32px 12px;">
        <tr><td align="center">
            <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background:#0A0A15; border:1px solid rgba(230,181,60,0.18); border-radius:24px; overflow:hidden; font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
                <!-- Header com a marca -->
                <tr><td align="center" style="background:linear-gradient(135deg,#0C0B11 0%,#161009 100%); padding:36px 40px 30px; border-bottom:1px solid rgba(230,181,60,0.18);">
                    <img src="{logo_url}" alt="MySuperStore" width="240" style="display:block; width:240px; max-width:70%; height:auto;">
                </td></tr>
                <!-- Conteúdo -->
                <tr><td class="px" style="padding:40px;">
                    <h2 style="margin:0 0 18px; color:#ffffff; font-size:22px; font-weight:800; letter-spacing:-0.5px;">{title}</h2>
                    <div style="color:#b8b8c0; font-size:15px; line-height:1.65;">
                        {content}
                    </div>
                </td></tr>
                <!-- Footer -->
                <tr><td align="center" style="background:#070710; padding:24px 40px; border-top:1px solid rgba(255,255,255,0.06);">
                    <p style="margin:0 0 4px; color:#E6B53C; font-size:13px; font-weight:700;">MySuperStore</p>
                    <p style="margin:0; color:#52525b; font-size:12px; line-height:1.5;">O Centro da Gravidade Comercial<br>&copy; {year} MySuperStore — Todos os direitos reservados.</p>
                </td></tr>
            </table>
        </td></tr>
    </table>
</body>
</html>"""

def send_transactional_email(to_email, subject, title, html_content):
    """Função genérica de disparo de e-mail."""
    from_email = settings.DEFAULT_FROM_EMAIL or "no-reply@mysuperstore.com"
    html_body = get_base_html_template(title, html_content)
    text_body = f"{title}\n\nAcesse sua conta para ver os detalhes."
    
    try:
        msg = EmailMultiAlternatives(subject, text_body, from_email, [to_email])
        msg.attach_alternative(html_body, "text/html")
        msg.send(fail_silently=False)
    except Exception as exc:
        logger.error("Falha ao enviar e-mail para %s: %s", to_email, exc)


# --- EVENTOS DE NEGÓCIO ---

def notify_order_confirmed_customer(order):
    """Dispara Notificação + E-mail para o COMPRADOR quando o pagamento é aprovado."""
    user = order.user
    title = f"Pagamento Aprovado - Pedido #{order.order_number[-6:]}"
    message = "Seu pagamento foi confirmado! Seus itens já estão sendo preparados."
    
    # 1. E-mail
    html = f"""
        <p>Olá, {user.first_name}!</p>
        <p>O pagamento do seu pedido <strong>#{order.order_number}</strong> foi confirmado com sucesso.</p>
        <p>Acompanhe o status do envio diretamente no seu painel:</p>
        <a href="{settings.FRONTEND_URL.rstrip('/')}/orders" class="cta-button">Ver Meus Pedidos</a>
    """
    send_transactional_email(user.email, title, title, html)
    
    # 2. Push App
    send_web_push(user, "Pagamento Aprovado! 💳", message, url="/orders")


def notify_order_pending_customer(order):
    """Dispara alerta de carrinho abandonado (PIX pendente)."""
    user = order.user
    title = f"Você tem um PIX aguardando pagamento!"
    message = "O seu pedido ainda não foi finalizado. Garanta seus produtos antes que o PIX expire."
    
    html = f"""
        <p>Olá, {user.first_name}!</p>
        <p>Notamos que você gerou um PIX para o pedido <strong>#{order.order_number}</strong> mas ainda não identificamos o pagamento.</p>
        <p>Os lojistas já estão com seus produtos reservados, mas o tempo está acabando. Após a expiração do QR Code, os itens voltarão para o estoque e podem esgotar!</p>
        <br>
        <a href="{settings.FRONTEND_URL.rstrip('/')}/orders" class="cta-button">Pagar Agora</a>
    """
    send_transactional_email(user.email, title, title, html)
    send_web_push(user, "PIX Pendente ⏳", message, url="/orders")

def _format_brl(value):
    """Formata um valor em Real (R$ 1.234,56)."""
    from decimal import Decimal
    v = Decimal(str(value or 0))
    return "R$ " + f"{v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def _efi_fee(method, amount):
    """Taxa estimada do Efí Bank para a forma de pagamento (paga pela plataforma)."""
    from decimal import Decimal
    amount = Decimal(str(amount or 0))
    if method in ("credit_card", "debit_card"):
        pct = Decimal(str(getattr(settings, "EFI_CARD_FEE_PERCENT", "0")))
        fixed = Decimal(str(getattr(settings, "EFI_CARD_FEE_FIXED", "0")))
        label = "Cartão"
    else:
        pct = Decimal(str(getattr(settings, "EFI_PIX_FEE_PERCENT", "0")))
        fixed = Decimal(str(getattr(settings, "EFI_PIX_FEE_FIXED", "0")))
        label = "PIX"
    return (amount * pct + fixed).quantize(Decimal("0.01")), label


def notify_new_sale_seller(sub_order):
    """
    Dispara Notificação + E-mail (EXTRATO de pagamento) para o LOJISTA numa nova venda.
    Extrato claro: subtotal − comissão da plataforma = valor líquido; taxa Efí Bank
    mostrada de forma transparente (é paga pela plataforma, não descontada do lojista).
    """
    from decimal import Decimal
    seller = sub_order.seller
    seller_user = seller.user
    order = sub_order.order
    order_num = order.order_number[-6:]
    title = f"Nova venda confirmada · Pedido #{order_num}"

    rate = Decimal(str(seller.commission_rate or 0))
    rate_pct = (rate * 100).quantize(Decimal("0.01")).normalize()
    subtotal = Decimal(str(sub_order.subtotal or 0))
    commission = Decimal(str(sub_order.commission or 0))
    liquido = Decimal(str(sub_order.seller_amount or 0))

    payment = getattr(order, "payment", None)
    method = getattr(payment, "method", "pix")
    efi_fee, method_label = _efi_fee(method, subtotal)

    message = f"Você vendeu {_format_brl(subtotal)} — líquido {_format_brl(liquido)}. Separe os produtos!"

    row = (
        '<tr>'
        '<td style="padding:11px 0;border-bottom:1px solid rgba(255,255,255,0.07);color:#c7c7cf;font-size:14px;">{label}</td>'
        '<td style="padding:11px 0;border-bottom:1px solid rgba(255,255,255,0.07);text-align:right;color:{color};font-weight:700;font-size:14px;">{value}</td>'
        '</tr>'
    )

    html = f"""
        <p style="margin:0 0 6px; color:#ffffff; font-size:16px;">Parabéns, <strong>{seller.store_name}</strong>! 🎉</p>
        <p style="margin:0 0 22px;">Você acaba de receber uma nova venda. Aqui está o <strong style="color:#fff;">extrato de pagamento</strong> do Pedido <strong style="color:#fff;">#{order.order_number}</strong>, recebido via <strong style="color:#fff;">{method_label}</strong>.</p>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
            {row.format(label="Subtotal da venda", color="#ffffff", value=_format_brl(subtotal))}
            {row.format(label=f"Comissão da plataforma ({rate_pct}%)", color="#f87171", value="− " + _format_brl(commission))}
        </table>

        <!-- Destaque do valor líquido -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0 22px; background:linear-gradient(135deg,rgba(230,181,60,0.14),rgba(230,181,60,0.04)); border:1px solid rgba(230,181,60,0.35); border-radius:14px;">
            <tr>
                <td style="padding:18px 22px; color:#E6B53C; font-size:14px; font-weight:700;">Você recebe (líquido)</td>
                <td style="padding:18px 22px; text-align:right; color:#E6B53C; font-size:24px; font-weight:800;">{_format_brl(liquido)}</td>
            </tr>
        </table>

        <p style="margin:0 0 6px; color:#8a8a93; font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">Transparência de taxas</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">
            <tr>
                <td style="padding:6px 0; color:#9a9aa3; font-size:13px;">Taxa Efí Bank ({method_label})</td>
                <td style="padding:6px 0; text-align:right; color:#c7c7cf; font-size:13px;">{_format_brl(efi_fee)}</td>
            </tr>
        </table>
        <p style="margin:0 0 26px; padding:12px 16px; background:rgba(255,255,255,0.03); border-radius:10px; color:#9a9aa3; font-size:13px; line-height:1.55;">
            🔒 A taxa do <strong style="color:#c7c7cf;">Efí Bank</strong> é <strong style="color:#c7c7cf;">paga pela plataforma</strong> — não descontamos nada além da comissão. O valor líquido acima é exatamente o que cai na sua conta via split automático.
        </p>

        <a href="{settings.FRONTEND_URL.rstrip('/')}/seller/dashboard/orders" class="cta-button">Gerenciar minha venda →</a>
    """
    send_transactional_email(seller_user.email, title, "🎉 " + title, html)

    # 2. Push App
    send_web_push(seller_user, "Nova Venda! 🎉", message, url="/seller/dashboard/orders")


def notify_order_status_update(sub_order):
    """Dispara E-mail + Push para o COMPRADOR sobre a mudança de status."""
    user = sub_order.order.user
    order_num = sub_order.order.order_number[-6:]
    
    status_map = {
        "processing": "Separado em Loja",
        "shipped": "Em Rota de Entrega",
        "delivered": "Entregue"
    }
    
    status_str = status_map.get(sub_order.status, sub_order.status)
    title = f"Atualização: Pedido #{order_num}"
    message = f"Seus itens da loja {sub_order.seller.store_name} mudaram para: {status_str}!"
    
    extra_info = ""
    if sub_order.status == "shipped":
        carrier = getattr(sub_order, "carrier_name", "Transportadora") or "Transportadora"
        tracking = getattr(sub_order, "tracking_code", "")
        estimated = getattr(sub_order, "estimated_delivery_date", None)
        
        extra_info = f"""
        <p>Boa notícia! O lojista <strong>{sub_order.seller.store_name}</strong> acabou de despachar o seu pacote via <strong>{carrier}</strong>.</p>
        """
        if tracking:
            if tracking.startswith("http"):
                extra_info += f'<p>Acompanhe em tempo real: <a href="{tracking}" target="_blank" style="color:#E6B53C;font-weight:bold;">{tracking}</a></p>'
            else:
                extra_info += f'<p>Seu código de rastreio é: <strong style="color:#E6B53C;">{tracking}</strong></p>'
        if estimated:
            from django.utils.formats import date_format
            extra_info += f'<p>Previsão de entrega: <strong>{date_format(estimated, r"d \d\e F")}</strong></p>'
    elif sub_order.status == "processing":
        extra_info = f"<p>A loja <strong>{sub_order.seller.store_name}</strong> começou a separar o seu pacote. Logo ele será despachado!</p>"
    else:
        extra_info = f'<p>A loja <strong>{sub_order.seller.store_name}</strong> atualizou o status da entrega para: <strong style="color:#E6B53C;">{status_str}</strong>.</p>'
        
    html = f"""
        <p>Olá, {user.first_name}!</p>
        <p>Temos uma atualização sobre o seu pedido <strong>#{sub_order.order.order_number}</strong>.</p>
        {extra_info}
        <br>
        <a href="{settings.FRONTEND_URL.rstrip('/')}/orders" class="cta-button">Acompanhar Entrega no App</a>
    """
    send_transactional_email(user.email, title, title, html)
    send_web_push(user, f"Pedido {status_str} 📦", message, url="/orders")


def notify_invoice_available(sub_order):
    """Dispara E-mail + Push para o COMPRADOR quando a NF é anexada."""
    user = sub_order.order.user
    order_num = sub_order.order.order_number[-6:]
    title = f"Nota Fiscal Emitida - Pedido #{order_num}"
    message = f"A loja {sub_order.seller.store_name} enviou a Nota Fiscal."
    
    html = f"""
        <p>Olá, {user.first_name}!</p>
        <p>A loja <strong>{sub_order.seller.store_name}</strong> anexou a sua Nota Fiscal para o pedido #{sub_order.order.order_number}.</p>
        <a href="{sub_order.invoice_link}" target="_blank" class="cta-button">Baixar Nota Fiscal (PDF)</a>
    """
    send_transactional_email(user.email, title, title, html)
    send_web_push(user, "Nota Fiscal Disponível 📄", message, url="/orders")


def notify_password_changed(user):
    """Dispara E-mail + Push para o usuário informando que a senha foi alterada."""
    title = "Sua senha foi alterada"
    message = "A senha da sua conta MySuperStore acabou de ser alterada."
    
    html = f"""
        <p>Olá, {user.first_name or 'Usuário'}!</p>
        <p>Este é um aviso de segurança para informar que a senha da sua conta <strong>MySuperStore</strong> foi alterada com sucesso.</p>
        <p>Se foi você quem fez essa alteração, nenhuma ação é necessária.</p>
        <p style="color:#f87171;">Se você <strong>não</strong> fez essa alteração, por favor entre em contato com nosso suporte imediatamente para recuperar sua conta.</p>
        <a href="{settings.FRONTEND_URL.rstrip('/')}/login" class="cta-button">Acessar minha conta</a>
    """
    send_transactional_email(user.email, title, title, html)
    send_web_push(user, "Senha Alterada 🔒", message, url="/")
