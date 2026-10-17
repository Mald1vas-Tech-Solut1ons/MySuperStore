"""Migra avatares guardados em base64 no banco (users_user.avatar_base64) para o storage de mídia.

Seguro por construção:
- Por padrão é SIMULAÇÃO (não grava nada). Só altera dados com --apply.
- O base64 só é apagado DEPOIS que o arquivo foi salvo no storage com sucesso.
- Idempotente: quem já tem arquivo (avatar) é ignorado; pode rodar quantas vezes quiser.
- Uma foto inválida/corrompida é relatada e mantida como está (nada é apagado).
- Reduz a foto (máx. 512 px) e grava em WebP: avatares chegavam a 3 MB.
"""
import base64
import io
import re
import uuid

from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from PIL import Image, UnidentifiedImageError

DATA_URL = re.compile(r"^data:image/[\w.+-]+;base64,(?P<b64>.+)$", re.DOTALL)
MAX_SIDE = 512


def converter(avatar_base64: str) -> bytes:
    """data URL base64 -> bytes de uma imagem WebP reduzida. Levanta ValueError se inválida."""
    m = DATA_URL.match(avatar_base64.strip())
    if not m:
        raise ValueError("não é um data URL de imagem em base64")
    try:
        raw = base64.b64decode(m.group("b64"), validate=False)
        img = Image.open(io.BytesIO(raw))
        img.load()
    except (ValueError, UnidentifiedImageError, OSError) as exc:
        raise ValueError(f"imagem inválida: {exc}") from exc
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGBA" if "transparency" in img.info or img.mode in ("LA", "PA") else "RGB")
    img.thumbnail((MAX_SIDE, MAX_SIDE))
    out = io.BytesIO()
    img.save(out, format="WEBP", quality=85)
    return out.getvalue()


class Command(BaseCommand):
    help = "Migra users_user.avatar_base64 para o storage de mídia (simulação por padrão; use --apply)."

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true", help="Grava de verdade (sem isto, só simula).")
        parser.add_argument("--limit", type=int, default=0, help="Processa no máximo N usuários (0 = todos).")

    def handle(self, *args, **opts):
        User = get_user_model()
        apply = opts["apply"]
        self.stdout.write(self.style.WARNING("MODO: APLICAR" if apply else "MODO: SIMULAÇÃO (nada será gravado)"))

        ids = list(
            User.objects.exclude(avatar_base64__isnull=True).exclude(avatar_base64="")
            .order_by("date_joined").values_list("pk", flat=True)
        )
        if opts["limit"]:
            ids = ids[: opts["limit"]]
        self.stdout.write(f"{len(ids)} usuário(s) com avatar em base64.")

        migrados = ignorados = falhas = 0
        bytes_antes = bytes_depois = 0
        for pk in ids:
            user = User.objects.get(pk=pk)
            b64 = user.avatar_base64 or ""
            if user.avatar:
                self.stdout.write(f"  [ignorado] {user.email}: já tem arquivo; base64 mantido (revisar à mão).")
                ignorados += 1
                continue
            try:
                webp = converter(b64)
            except ValueError as exc:
                self.stdout.write(self.style.ERROR(f"  [falha]    {user.email}: {exc}. Nada alterado."))
                falhas += 1
                continue
            bytes_antes += len(b64)
            bytes_depois += len(webp)
            self.stdout.write(f"  [ok]       {user.email}: {len(b64):,} -> {len(webp):,} bytes")
            if apply:
                try:
                    user.avatar.save(f"{user.pk}-{uuid.uuid4().hex[:8]}.webp", ContentFile(webp), save=False)
                    # Só limpa o base64 depois que o arquivo foi salvo no storage.
                    user.avatar_base64 = None
                    user.save(update_fields=["avatar", "avatar_base64"])
                except Exception as exc:  # storage fora do ar etc.: mantém o base64
                    self.stdout.write(self.style.ERROR(f"  [falha]    {user.email}: ao salvar ({exc}). Base64 mantido."))
                    falhas += 1
                    continue
            migrados += 1

        self.stdout.write(self.style.SUCCESS(
            f"Resumo: {'migrados' if apply else 'migráveis'}={migrados} ignorados={ignorados} falhas={falhas} | "
            f"{bytes_antes:,} -> {bytes_depois:,} bytes"
        ))
