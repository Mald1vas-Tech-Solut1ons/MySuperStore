"""Gera os .env de uma loja nova a partir de um YAML (modelo: deploy/store.example.yaml).

Uso:
  python scripts/new_store_env.py deploy/stores/<slug>.yaml --out deploy/stores/<slug>/ [--keep <.env.prod em uso>] [--force]

Saída em --out:
  frontend.env      NEXT_PUBLIC_* para a Vercel (Settings → Environment Variables)
  backend.env.prod  variáveis do Django (vai para shared/.env.prod na VM)
  deploy.env        API_DOMAIN (vai para shared/deploy.env na VM)

Nunca imprime valores. Segredos ausentes (DJANGO_SECRET_KEY, POSTGRES_PASSWORD,
EFI_WEBHOOK_SECRET) são gerados; --keep reaproveita os de um .env.prod já em uso
(trocar a senha do banco depois do primeiro deploy quebraria a conexão).
"""
import argparse
import re
import secrets
from pathlib import Path
from urllib.parse import urlparse

import yaml

KEPT_SECRETS = ("DJANGO_SECRET_KEY", "POSTGRES_PASSWORD", "EFI_WEBHOOK_SECRET")
HEX = re.compile(r"^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")

FRONT = [
    ("mode", "NEXT_PUBLIC_STORE_MODE"), ("name", "NEXT_PUBLIC_BRAND_NAME"),
    ("full_name", "NEXT_PUBLIC_BRAND_FULL_NAME"), ("tagline", "NEXT_PUBLIC_BRAND_TAGLINE"),
    ("segment", "NEXT_PUBLIC_BRAND_SEGMENT"), ("shop_noun", "NEXT_PUBLIC_BRAND_SHOP_NOUN"),
    ("location", "NEXT_PUBLIC_BRAND_LOCATION"), ("shipping", "NEXT_PUBLIC_BRAND_SHIPPING"),
    ("announcement", "NEXT_PUBLIC_BRAND_ANNOUNCEMENT"), ("whatsapp", "NEXT_PUBLIC_WHATSAPP"),
    ("instagram", "NEXT_PUBLIC_INSTAGRAM"),
    ("meta.title", "NEXT_PUBLIC_BRAND_META_TITLE"), ("meta.description", "NEXT_PUBLIC_BRAND_META_DESCRIPTION"),
    ("meta.short", "NEXT_PUBLIC_BRAND_META_SHORT"),
    ("hero.eyebrow", "NEXT_PUBLIC_BRAND_HERO_EYEBROW"), ("hero.title", "NEXT_PUBLIC_BRAND_HERO_TITLE"),
    ("hero.emphasis", "NEXT_PUBLIC_BRAND_HERO_EMPHASIS"), ("hero.subtitle", "NEXT_PUBLIC_BRAND_HERO_SUBTITLE"),
    ("hero.image", "NEXT_PUBLIC_BRAND_HERO_IMAGE"), ("hero.image_alt", "NEXT_PUBLIC_BRAND_HERO_ALT"),
    ("detail_image", "NEXT_PUBLIC_BRAND_DETAIL_IMAGE"), ("detail_alt", "NEXT_PUBLIC_BRAND_DETAIL_ALT"),
    ("og_alt", "NEXT_PUBLIC_BRAND_OG_ALT"), ("marquee", "NEXT_PUBLIC_BRAND_MARQUEE"),
    ("collection_subtitle", "NEXT_PUBLIC_BRAND_COLLECTION_SUBTITLE"),
    ("search.placeholder", "NEXT_PUBLIC_BRAND_SEARCH_PLACEHOLDER"),
    ("search.suggestions", "NEXT_PUBLIC_BRAND_SEARCH_SUGGESTIONS"),
    ("chat.greeting", "NEXT_PUBLIC_BRAND_CHAT_GREETING"), ("chat.chips", "NEXT_PUBLIC_BRAND_CHAT_CHIPS"),
    ("video.eyebrow", "NEXT_PUBLIC_BRAND_VIDEO_EYEBROW"), ("video.title", "NEXT_PUBLIC_BRAND_VIDEO_TITLE"),
    ("video.emphasis", "NEXT_PUBLIC_BRAND_VIDEO_EMPHASIS"), ("video.text", "NEXT_PUBLIC_BRAND_VIDEO_TEXT"),
    ("video.caption", "NEXT_PUBLIC_BRAND_VIDEO_CAPTION"), ("video.steps", "NEXT_PUBLIC_BRAND_VIDEO_STEPS"),
    ("custom_order_text", "NEXT_PUBLIC_BRAND_CUSTOM_ORDER_TEXT"),
    ("colors.bg", "NEXT_PUBLIC_COLOR_BG"), ("colors.bg_alt", "NEXT_PUBLIC_COLOR_BG_ALT"),
    ("colors.surface", "NEXT_PUBLIC_COLOR_SURFACE"), ("colors.primary", "NEXT_PUBLIC_COLOR_PRIMARY"),
    ("colors.accent", "NEXT_PUBLIC_COLOR_ACCENT"), ("colors.secondary", "NEXT_PUBLIC_COLOR_SECONDARY"),
    ("colors.dark", "NEXT_PUBLIC_COLOR_DARK"), ("colors.text", "NEXT_PUBLIC_COLOR_TEXT"),
    ("legal.name", "NEXT_PUBLIC_LEGAL_NAME"), ("legal.document", "NEXT_PUBLIC_LEGAL_DOCUMENT"),
    ("legal.address", "NEXT_PUBLIC_LEGAL_ADDRESS"), ("legal.email", "NEXT_PUBLIC_LEGAL_EMAIL"),
    ("credit_url", "NEXT_PUBLIC_CREDIT_URL"),
]
BACK = [("mode", "STORE_MODE"), ("name", "STORE_NAME"), ("full_name", "STORE_FULL_NAME"),
        ("segment", "STORE_SEGMENT"), ("about", "STORE_ABOUT")]


def _get(d, dotted):
    """Valor em chaves pontuadas ("hero.title"), ou None."""
    cur = d
    for part in dotted.split("."):
        if not isinstance(cur, dict):
            return None
        cur = cur.get(part)
    return cur


def _text(v):
    """Valor do YAML como texto de env; None/"" → None (não escreve)."""
    if v is None:
        return None
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, list):
        v = "|".join(str(x).strip() for x in v if str(x).strip())
    v = str(v).strip()
    return v or None


def _apply(env, table, store):
    for path, name in table:
        value = _text(_get(store, path))
        if value is not None:
            env[name] = value


def frontend_env(store, api_url, api_host):
    env = {}
    _apply(env, FRONT, store)
    lookbook = [f"{i['src']}::{i.get('alt') or ''}" for i in store.get("lookbook") or [] if isinstance(i, dict) and i.get("src")]
    if lookbook:
        env["NEXT_PUBLIC_BRAND_LOOKBOOK"] = "|".join(lookbook)
    nav = [f"{i['label']}={i['slug']}" for i in store.get("nav") or [] if isinstance(i, dict) and i.get("label") and i.get("slug")]
    if nav:
        env["NEXT_PUBLIC_BRAND_NAV"] = "|".join(nav)
    films = (store.get("video") or {}).get("films")
    if films is False:
        env["NEXT_PUBLIC_BRAND_VIDEO_FILMS"] = "-"
    elif films := [f"{i['src']}::{i.get('poster') or ''}::{i.get('label') or ''}" for i in films or [] if isinstance(i, dict) and i.get("src")]:
        env["NEXT_PUBLIC_BRAND_VIDEO_FILMS"] = "|".join(films)
    if store.get("custom_order") is False:
        env["NEXT_PUBLIC_BRAND_CUSTOM_ORDER"] = "off"
    # Cores sem "#": em .env sem aspas, "#" vira comentário e a cor some (palette.ts aceita sem "#").
    for name in [k for k in env if k.startswith("NEXT_PUBLIC_COLOR_")]:
        env[name] = env[name].lstrip("#")
    env["NEXT_PUBLIC_API_URL"] = api_url + "/api/v1"
    env["NEXT_PUBLIC_WS_URL"] = "wss://" + api_host
    return env


def backend_env(store, front_url, api_url, api_host, kept):
    secret = {
        "DJANGO_SECRET_KEY": kept.get("DJANGO_SECRET_KEY") or secrets.token_urlsafe(50),
        "POSTGRES_PASSWORD": kept.get("POSTGRES_PASSWORD") or secrets.token_hex(24),
        "EFI_WEBHOOK_SECRET": kept.get("EFI_WEBHOOK_SECRET") or secrets.token_urlsafe(32),
    }
    env = {
        "DJANGO_SECRET_KEY": secret["DJANGO_SECRET_KEY"],
        "DJANGO_DEBUG": "False",
        "DJANGO_ALLOWED_HOSTS": f"{api_host},localhost,127.0.0.1",
        "CORS_ALLOWED_ORIGINS": front_url,
        "FRONTEND_URL": front_url,
        "BACKEND_PUBLIC_URL": api_url,
        "EMAIL_BACKEND": "django.core.mail.backends.smtp.EmailBackend",
        "POSTGRES_DB": "mysuperstore",
        "POSTGRES_USER": "mysuperstore",
        "POSTGRES_PASSWORD": secret["POSTGRES_PASSWORD"],
        "DATABASE_URL": f"postgres://mysuperstore:{secret['POSTGRES_PASSWORD']}@postgres:5432/mysuperstore",
        "REDIS_URL": "redis://redis:6379/2",
        "CELERY_BROKER_URL": "redis://redis:6379/0",
        "CELERY_RESULT_BACKEND": "redis://redis:6379/1",
        "EFI_PIX_CERT_HOMOL": "/app/certs/homologacao.p12",
        "EFI_PIX_CERT_PROD": "/app/certs/producao.p12",
        "EFI_WEBHOOK_SECRET": secret["EFI_WEBHOOK_SECRET"],
    }
    _apply(env, BACK, store)
    if store.get("mode") == "single":
        env["PLATFORM_COMMISSION_RATE"] = "0"
    return env


def env_line(key, value, quote):
    """KEY=VALUE; com quote, valor com "#" vai entre aspas (senão o dotenv corta como comentário)."""
    if quote and "#" in value:
        value = f"'{value}'" if "'" not in value else f'"{value}"'
    return f"{key}={value}\n"


def read_env(path):
    data = {}
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            data[k.strip()] = v.strip()
    return data


def validate(cfg):
    store, domains = cfg.get("store") or {}, cfg.get("domains") or {}
    errors = []
    if not re.fullmatch(r"[a-z0-9-]{3,50}", str(store.get("slug") or "")):
        errors.append("store.slug: use 3–50 letras minúsculas, números ou hífen")
    if store.get("mode") not in ("single", "marketplace"):
        errors.append("store.mode: use single ou marketplace")
    for key in ("frontend", "api"):
        if not str(domains.get(key) or "").startswith("https://"):
            errors.append(f"domains.{key}: precisa começar com https://")
    for name, value in (store.get("colors") or {}).items():
        if value and not HEX.match(str(value)):
            errors.append(f"store.colors.{name}: hex inválido (use #RGB ou #RRGGBB)")
    if errors:
        raise SystemExit("YAML inválido:\n- " + "\n- ".join(errors))
    return store, domains


def build(cfg, kept=None):
    """Monta (frontend, backend, deploy) a partir do YAML já carregado."""
    store, domains = validate(cfg)
    front_url = str(domains["frontend"]).rstrip("/")
    api_url = str(domains["api"]).rstrip("/")
    api_host = urlparse(api_url).netloc
    front = frontend_env(store, api_url, api_host)
    back = backend_env(store, front_url, api_url, api_host, kept or {})
    # Seções livres do YAML (Efí, Melhor Envio, e-mail…) sobrescrevem as derivadas.
    front.update({k: t for k, v in ((cfg.get("frontend") or {}).get("env") or {}).items() if (t := _text(v)) is not None})
    back.update({k: t for k, v in ((cfg.get("backend") or {}).get("env") or {}).items() if (t := _text(v)) is not None})
    for name, value in {**front, **back}.items():
        if "\n" in value or "\r" in value:
            raise SystemExit(f"{name}: valor com quebra de linha não é permitido")
    return front, back, {"API_DOMAIN": api_host}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("yaml")
    ap.add_argument("--out", required=True)
    ap.add_argument("--keep", help=".env.prod já em uso, para reaproveitar os segredos")
    ap.add_argument("--force", action="store_true", help="sobrescreve arquivos existentes")
    a = ap.parse_args()

    cfg = yaml.safe_load(Path(a.yaml).read_text(encoding="utf-8")) or {}
    front, back, deploy = build(cfg, read_env(a.keep) if a.keep else {})

    out = Path(a.out)
    files = {"frontend.env": front, "backend.env.prod": back, "deploy.env": deploy}
    existing = [name for name in files if (out / name).exists()]
    if existing and not a.force:
        raise SystemExit(f"Já existe em {out}: {', '.join(existing)} (use --force para sobrescrever)")
    out.mkdir(parents=True, exist_ok=True)
    for name, env in files.items():
        text = "".join(env_line(k, v, quote=name == "frontend.env") for k, v in env.items())
        (out / name).write_text(text, encoding="utf-8", newline="\n")
    print(f"OK: {len(front)} variáveis frontend, {len(back)} backend em {out}")


if __name__ == "__main__":
    main()
