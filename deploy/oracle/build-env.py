"""Gera shared/.env.prod e shared/deploy.env a partir do .env local.

Roda na máquina local; nunca imprime valores. Mantém integrações (Efí, e-mail,
Cloudinary, VAPID, Melhor Envio) e troca só o que muda na Oracle: banco, Redis,
domínios e chave do Django.

Uso:
  python deploy/oracle/build-env.py --ip 1.2.3.4 --src ../../.env --out <dir> [--keep <.env.prod atual>]

--keep preserva DJANGO_SECRET_KEY e a senha do Postgres de um .env.prod já em uso
(regerar a senha do banco depois do primeiro deploy quebraria a conexão).
"""
import argparse
import secrets
from pathlib import Path

FRONTEND = "https://mysuperstore-lime.vercel.app"
DROP = {"DATABASE_URL", "MEILI_MASTER_KEY", "MEILI_URL", "MEILI_HOST", "REDIS_URL",
        "CELERY_BROKER_URL", "CELERY_RESULT_BACKEND", "POSTGRES_DB", "POSTGRES_USER",
        "POSTGRES_PASSWORD", "DJANGO_SECRET_KEY", "DJANGO_DEBUG", "DJANGO_ALLOWED_HOSTS",
        "CORS_ALLOWED_ORIGINS", "FRONTEND_URL", "EFI_PIX_CERT_HOMOL", "EFI_PIX_CERT_PROD",
        "EMAIL_BACKEND"}


def parse(path):
    data = {}
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            data[k.strip()] = v.strip()
    return data


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ip", required=True)
    ap.add_argument("--src", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--keep")
    a = ap.parse_args()

    src = parse(a.src)
    kept = parse(a.keep) if a.keep else {}
    domain = f"mysuperstore-api.{a.ip}.sslip.io"
    pg_pass = kept.get("POSTGRES_PASSWORD") or secrets.token_hex(24)

    env = {k: v for k, v in src.items() if k not in DROP}
    env.update({
        "DJANGO_SECRET_KEY": kept.get("DJANGO_SECRET_KEY") or secrets.token_urlsafe(50),
        "DJANGO_DEBUG": "False",
        "DJANGO_ALLOWED_HOSTS": f"{domain},localhost,127.0.0.1",
        "CORS_ALLOWED_ORIGINS": FRONTEND,
        "FRONTEND_URL": FRONTEND,
        "EMAIL_BACKEND": "django.core.mail.backends.smtp.EmailBackend",
        "POSTGRES_DB": "mysuperstore",
        "POSTGRES_USER": "mysuperstore",
        "POSTGRES_PASSWORD": pg_pass,
        "DATABASE_URL": f"postgres://mysuperstore:{pg_pass}@postgres:5432/mysuperstore",
        "REDIS_URL": "redis://redis:6379/2",
        "CELERY_BROKER_URL": "redis://redis:6379/0",
        "CELERY_RESULT_BACKEND": "redis://redis:6379/1",
        "EFI_PIX_CERT_HOMOL": "/app/certs/homologacao.p12",
        "EFI_PIX_CERT_PROD": "/app/certs/producao.p12",
    })

    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    (out / ".env.prod").write_text("".join(f"{k}={v}\n" for k, v in env.items()), encoding="utf-8", newline="\n")
    (out / "deploy.env").write_text(f"API_DOMAIN={domain}\n", encoding="utf-8", newline="\n")
    print(f"OK: {len(env)} variáveis em .env.prod; API_DOMAIN={domain}")


if __name__ == "__main__":
    main()
