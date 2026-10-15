import sentry_sdk

from .base import *  # noqa: F401, F403

DEBUG = False

# ── Whitenoise (servir statics) ───────────────────────────────────────────────
MIDDLEWARE.insert(1, "whitenoise.middleware.WhiteNoiseMiddleware")  # noqa: F405
STORAGES["staticfiles"] = {
    "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
}
# django-cloudinary-storage ainda lê STATICFILES_STORAGE no collectstatic
# (removido no Django 5.1); sem isto o collectstatic quebra com AttributeError.
STATICFILES_STORAGE = STORAGES["staticfiles"]["BACKEND"]

# ── Segurança ─────────────────────────────────────────────────────────────────
# Railway e Vercel terminam SSL no edge — o app recebe HTTP internamente
SECURE_SSL_REDIRECT = False
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

# ── Sentry ────────────────────────────────────────────────────────────────────
sentry_sdk.init(
    dsn=env("SENTRY_DSN", default=""),  # noqa: F405
    traces_sample_rate=0.2,
    profiles_sample_rate=0.1,
)

# O armazenamento em nuvem (Cloudinary) agora é gerenciado diretamente no base.py
