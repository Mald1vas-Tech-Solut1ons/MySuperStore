from datetime import timedelta
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env()
# Lê .env em desenvolvimento; em produção (Railway/Vercel) as vars vêm do ambiente
_env_file = BASE_DIR.parent / ".env"
if _env_file.exists():
    environ.Env.read_env(_env_file)

SECRET_KEY = env("DJANGO_SECRET_KEY")
DEBUG = env.bool("DJANGO_DEBUG", default=False)
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=[])

DJANGO_APPS = [
    "daphne",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_filters",
    "storages",
    "django_celery_beat",
    "drf_spectacular",
    "django_extensions",
    "channels",
]

LOCAL_APPS = [
    "apps.users",
    "apps.sellers",
    "apps.assistant",
    "apps.catalog",
    "apps.carts",
    "apps.orders",
    "apps.payments",
    "apps.admin_api",
    "apps.crm",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

AUTH_USER_MODEL = "users.User"

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DATABASES = {
    "default": env.db("DATABASE_URL", default="sqlite:///db.sqlite3")
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "pt-br"
TIME_ZONE = "America/Sao_Paulo"
USE_I18N = True
USE_TZ = True

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ── Static & Media & Storages (Django 5.1+) ──────────────────────────────────
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

USE_S3 = env.bool("USE_S3", default=False)

if USE_S3:
    AWS_ACCESS_KEY_ID = env("AWS_ACCESS_KEY_ID", default="")
    AWS_SECRET_ACCESS_KEY = env("AWS_SECRET_ACCESS_KEY", default="")
    AWS_STORAGE_BUCKET_NAME = env("AWS_STORAGE_BUCKET_NAME", default="")
    AWS_S3_ENDPOINT_URL = env("AWS_S3_ENDPOINT_URL", default=None)
    AWS_S3_CUSTOM_DOMAIN = env("AWS_S3_CUSTOM_DOMAIN", default=None)
    AWS_DEFAULT_ACL = "public-read"
    AWS_QUERYSTRING_AUTH = False
    
    STORAGES = {
        "default": {
            "BACKEND": "storages.backends.s3boto3.S3Boto3Storage",
        },
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
        },
    }
    
    if AWS_S3_CUSTOM_DOMAIN:
        MEDIA_URL = f"https://{AWS_S3_CUSTOM_DOMAIN}/"
    elif AWS_S3_ENDPOINT_URL:
        MEDIA_URL = f"{AWS_S3_ENDPOINT_URL}/{AWS_STORAGE_BUCKET_NAME}/"
    else:
        MEDIA_URL = f"https://{AWS_STORAGE_BUCKET_NAME}.s3.amazonaws.com/"
elif env("CLOUDINARY_URL", default=""):
    INSTALLED_APPS.insert(0, "cloudinary_storage")
    INSTALLED_APPS.insert(0, "cloudinary")
    STORAGES = {
        "default": {
            "BACKEND": "cloudinary_storage.storage.MediaCloudinaryStorage",
        },
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
        },
    }
else:
    STORAGES = {
        "default": {
            "BACKEND": "django.core.files.storage.FileSystemStorage",
        },
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
        },
    }
    MEDIA_URL = "/media/"
    MEDIA_ROOT = BASE_DIR / "media"

# ── Limites de upload (API roda numa VM de 1 GB) ─────────────────────────────
# Teto do corpo de qualquer requisição, aplicado no daphne antes de receber os bytes
# (config/daphne_patches.py). O maior envio legítimo pela API é o vídeo de apresentação
# da loja (30 MB) com logo/banners; o vídeo do produto vai direto ao Cloudinary.
MAX_REQUEST_BODY_BYTES = env.int("MAX_REQUEST_BODY_BYTES", default=55 * 1024 * 1024)
PRODUCT_PHOTO_MAX_BYTES = 10 * 1024 * 1024
PRODUCT_PHOTO_MAX_PIXELS = 40_000_000  # ~8000x5000; acima disso é bomba de descompressão
PRODUCT_VIDEO_MAX_BYTES = 50 * 1024 * 1024
PRODUCT_VIDEO_FORMATS = ["mp4", "mov", "webm"]

# ── DRF ─────────────────────────────────────────────────────────────────────
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_PAGINATION_CLASS": "core.pagination.StandardResultsSetPagination",
    "PAGE_SIZE": 24,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

# ── SimpleJWT ───────────────────────────────────────────────────────────────
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    # Sessão persistente estilo Instagram/Mercado Livre: o usuário só sai se
    # fizer logout. 90 dias de janela; como ROTATE renova o refresh a cada uso,
    # para um usuário ativo a sessão nunca expira (janela deslizante).
    "REFRESH_TOKEN_LIFETIME": timedelta(days=90),
    "ROTATE_REFRESH_TOKENS": True,
    # IMPORTANTE: blacklist DESLIGADO de propósito. Com mobile disparando várias
    # requisições em paralelo, se o token antigo fosse invalidado a cada rotação,
    # as chamadas concorrentes usariam um refresh já morto → logout indevido.
    "BLACKLIST_AFTER_ROTATION": False,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# ── CORS ────────────────────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=["http://localhost:3000"])
CORS_ALLOW_CREDENTIALS = True

# ── drf-spectacular (OpenAPI) ────────────────────────────────────────────────
SPECTACULAR_SETTINGS = {
    "TITLE": "MySuperStore API",
    "DESCRIPTION": "Marketplace multi-vendedor — documentação da API REST",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

# ── Celery ───────────────────────────────────────────────────────────────────
CELERY_BROKER_URL = env("CELERY_BROKER_URL", default="redis://localhost:6379/0")
CELERY_RESULT_BACKEND = env("CELERY_RESULT_BACKEND", default="redis://localhost:6379/1")
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = TIME_ZONE

# ── Channels ────────────────────────────────────────────────────────────────
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [env("REDIS_URL", default="redis://localhost:6379/2")],
        },
    },
}

# ── Email ────────────────────────────────────────────────────────────────────
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = env("MAIL_SERVER", default="smtp.gmail.com")
EMAIL_PORT = env.int("MAIL_PORT", default=587)
EMAIL_HOST_USER = env("MAIL_USERNAME", default="")
EMAIL_HOST_PASSWORD = env("MAIL_PASSWORD", default="")
EMAIL_USE_TLS = env.bool("MAIL_USE_TLS", default=True)
DEFAULT_FROM_EMAIL = env("MAIL_DEFAULT_SENDER", default=EMAIL_HOST_USER)

# ── Meilisearch ──────────────────────────────────────────────────────────────
MEILI_HOST = env("MEILI_HOST", default="http://localhost:7700")
EFI_WEBHOOK_SECRET = env("EFI_WEBHOOK_SECRET", default="")

# ── Loja (uma instalação por cliente) ─────────────────────────────────────────
# "single" = loja própria: ninguém abre loja pelo site (só staff/admin);
# "marketplace" = comportamento atual, com candidatura pública de lojistas.
STORE_MODE = env("STORE_MODE", default="marketplace")
# Marca usada no chat IA e nos e-mails. Padrão: Ateliê Eli Trassi.
STORE_NAME = env("STORE_NAME", default="Ateliê Eli Trassi")
STORE_FULL_NAME = env("STORE_FULL_NAME", default="Ateliê Eli Trassi Macramê")
STORE_SEGMENT = env("STORE_SEGMENT", default="macramê")
STORE_ABOUT = env(
    "STORE_ABOUT",
    default="ateliê de peças em macramê feitas à mão na Vila Galvão, Guarulhos-SP, que envia para todo o Brasil",
)
# Base de conhecimento do chat (texto factual da loja). Vazio = a do Ateliê.
ASSISTANT_KNOWLEDGE_FILE = env("ASSISTANT_KNOWLEDGE_FILE", default="")

# Assistente de atendimento (Gemini) — chave só no servidor; modelos em ordem de fallback.
GEMINI_API_KEY = env("GEMINI_API_KEY", default="")
GEMINI_MODELS = env.list("GEMINI_MODELS", default=["gemini-flash-latest", "gemini-3.5-flash", "gemini-flash-lite-latest"])
BACKEND_PUBLIC_URL = env("BACKEND_PUBLIC_URL", default="http://localhost:8000")
REST_FRAMEWORK.setdefault("DEFAULT_THROTTLE_RATES", {})["assistant"] = env("ASSISTANT_RATE", default="12/min")
REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["password_reset"] = env("PASSWORD_RESET_RATE", default="5/hour")
# Link de nova senha vale 2 horas (e morre assim que a senha muda).
PASSWORD_RESET_TIMEOUT = 60 * 60 * 2
# Frete grátis (pago pela loja) quando os produtos, já com desconto, somam ao menos isto.
from decimal import Decimal as _Decimal
FREE_SHIPPING_MIN = _Decimal(env("FREE_SHIPPING_MIN", default="299.00"))
# "melhor_envio" = cotação real; "flat" = preço fixo por loja (FLAT_SHIPPING_PRICE), decidido no servidor.
SHIPPING_MODE = env("SHIPPING_MODE", default="melhor_envio")
FLAT_SHIPPING_PRICE = _Decimal(env("FLAT_SHIPPING_PRICE", default="25.00"))
MEILI_MASTER_KEY = env("MEILI_MASTER_KEY", default="devmasterkey")

# ── Google OAuth ─────────────────────────────────────────────────────────────
GOOGLE_CLIENT_ID = env("GOOGLE_CLIENT_ID", default="1019190620170-a86680qpdbrjgu1vk31st0lts4ju3cm5.apps.googleusercontent.com")

# ── Frontend URL (para links nos e-mails) ─────────────────────────────────────
FRONTEND_URL = env("FRONTEND_URL", default="http://localhost:3000")

# ── Web Push (VAPID) ──────────────────────────────────────────────────────────
# Par de chaves geradas com `npx web-push generate-vapid-keys`.
# A chave pública correspondente fica no frontend (NEXT_PUBLIC_VAPID_PUBLIC_KEY).
VAPID_PRIVATE_KEY = env("VAPID_PRIVATE_KEY", default="")
VAPID_ADMIN_EMAIL = env("VAPID_ADMIN_EMAIL", default="mailto:suporte@mysuperstore.com")

# ── Melhor Envio ─────────────────────────────────────────────────────────────
MELHOR_ENVIO_TOKEN = env("MELHOR_ENVIO_TOKEN", default="")
MELHOR_ENVIO_ENVIRONMENT = env("MELHOR_ENVIO_ENVIRONMENT", default="sandbox")  # sandbox ou production
# OAuth (Modelo 1 — conta única da plataforma). Usados só pelo comando
# melhor_envio_token para obter/renovar o MELHOR_ENVIO_TOKEN.
MELHOR_ENVIO_CLIENT_ID = env("MELHOR_ENVIO_CLIENT_ID", default="")
MELHOR_ENVIO_CLIENT_SECRET = env("MELHOR_ENVIO_CLIENT_SECRET", default="")
MELHOR_ENVIO_REDIRECT_URI = env("MELHOR_ENVIO_REDIRECT_URI", default="")

# ── Efí Bank ──────────────────────────────────────────────────────────────────
# Dois apps Efí (cada um com credenciais próprias):
#   • API Pix       → PIX (precisa de certificado mTLS)
#   • API Cobranças → cartão de crédito (só OAuth, sem certificado)
EFI_ENV = env("EFI_ENV", default="sandbox")
EFI_SANDBOX = EFI_ENV != "production"
_efi_sfx = "HOMOL" if EFI_SANDBOX else "PROD"

# --- API Pix ---
EFI_PIX_CLIENT_ID = env(f"EFI_PIX_CLIENT_ID_{_efi_sfx}", default="")
EFI_PIX_CLIENT_SECRET = env(f"EFI_PIX_CLIENT_SECRET_{_efi_sfx}", default="")
EFI_PIX_CERT_PATH = env(f"EFI_PIX_CERT_{_efi_sfx}", default="")

# Cert via base64 (para Railway, onde não dá para montar arquivo).
# Se EFI_PIX_CERT_BASE64 estiver setado, decodifica o .p12 para um arquivo temporário
# e usa esse caminho — assim o deploy do PIX é 100% por variável de ambiente.
_efi_cert_b64 = env("EFI_PIX_CERT_BASE64", default="")
if _efi_cert_b64:
    import base64 as _b64
    import os as _os
    import tempfile as _tf
    _cert_file = _os.path.join(_tf.gettempdir(), "efi_pix_cert.p12")
    with open(_cert_file, "wb") as _fh:
        _fh.write(_b64.b64decode(_efi_cert_b64))
    EFI_PIX_CERT_PATH = _cert_file

EFI_PIX_KEY = env("EFI_PIX_KEY", default="")  # chave PIX recebedora da plataforma
EFI_PIX_EXPIRACAO = env.int("EFI_PIX_EXPIRACAO", default=3600)

# --- API Cobranças (cartão) ---
EFI_COBRANCAS_CLIENT_ID = env(f"EFI_COBRANCAS_CLIENT_ID_{_efi_sfx}", default="")
EFI_COBRANCAS_CLIENT_SECRET = env(f"EFI_COBRANCAS_CLIENT_SECRET_{_efi_sfx}", default="")
# Identificador de conta usado pelo Efí.js (tokenização do cartão no frontend)
EFI_ACCOUNT_IDENTIFIER = env("EFI_ACCOUNT_IDENTIFIER", default="")

# Compat: EfiPixService consome estes nomes "genéricos"
EFI_CLIENT_ID = EFI_PIX_CLIENT_ID
EFI_CLIENT_SECRET = EFI_PIX_CLIENT_SECRET
EFI_CERT_PATH = EFI_PIX_CERT_PATH

# ── Split / Comissão / Taxas ──────────────────────────────────────────────────
# Comissão da plataforma (product owner). O lojista recebe (1 - taxa) do subtotal.
# É também o default de novos lojistas (Seller.commission_rate).
PLATFORM_COMMISSION_RATE = env("PLATFORM_COMMISSION_RATE", default="0.12")  # 12%

# Taxas cobradas pelo Efí Bank — quem absorve é a PLATAFORMA (saem da comissão de 12%);
# o lojista recebe o seller_amount cheio. Usadas no extrato para transparência.
# ⚠️ CONFIRME os valores no SEU contrato Efí — os defaults abaixo são placeholders.
EFI_PIX_FEE_PERCENT  = env("EFI_PIX_FEE_PERCENT",  default="0.0099")  # ex.: 0,99% por PIX
EFI_PIX_FEE_FIXED    = env("EFI_PIX_FEE_FIXED",    default="0.00")    # ex.: R$ fixo por PIX
EFI_CARD_FEE_PERCENT = env("EFI_CARD_FEE_PERCENT", default="0.0399")  # ex.: 3,99% por cartão
EFI_CARD_FEE_FIXED   = env("EFI_CARD_FEE_FIXED",   default="0.39")    # ex.: R$ fixo por cartão
