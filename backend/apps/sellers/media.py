"""Vídeo do produto no Cloudinary sem passar os bytes pela API.

Fluxo: a API assina um upload com ``public_id`` fixo para o produto → o navegador envia o
arquivo direto ao Cloudinary → a API confirma pela Admin API (existe, tamanho, formato) e
só grava ``video_external``. A VM de 1 GB nunca recebe o vídeo.
"""
import logging
import re
import secrets
import time

from django.conf import settings

logger = logging.getLogger(__name__)

VIDEO_FOLDER = "products/videos/"
UPLOAD_LARGE_CHUNK_BYTES = 6 * 1024 * 1024
VIDEO_TAG = "mss-product-video"


def cloudinary_enabled():
    return settings.STORAGES.get("default", {}).get("BACKEND") == "cloudinary_storage.storage.MediaCloudinaryStorage"


def _prefix(product):
    return f"{VIDEO_FOLDER}{product.pk}-"


def new_video_public_id(product):
    return f"{_prefix(product)}{secrets.token_hex(6)}"


def is_product_video_public_id(product, public_id):
    return bool(re.fullmatch(re.escape(_prefix(product)) + r"[0-9a-f]{12}", public_id or ""))


def public_id_from_url(product, url):
    """public_id de um vídeo gerenciado por este fluxo para o produto, ou None."""
    m = re.search(r"/video/upload/(?:v\d+/)?(" + re.escape(_prefix(product)) + r"[0-9a-f]{12})(?:\.\w+)?$", url or "")
    return m.group(1) if m else None


def signed_upload(product):
    """Parâmetros para o navegador subir o vídeo direto ao Cloudinary."""
    import cloudinary
    import cloudinary.utils

    cfg = cloudinary.config()
    params = {
        "timestamp": int(time.time()),
        "public_id": new_video_public_id(product),
        "allowed_formats": ",".join(settings.PRODUCT_VIDEO_FORMATS),
        "tags": VIDEO_TAG,
    }
    return {
        "direct": True,
        "upload_url": cloudinary.utils.cloudinary_api_url("upload", resource_type="video"),
        "api_key": cfg.api_key,
        "signature": cloudinary.utils.api_sign_request(params, cfg.api_secret),
        "params": params,
        "max_bytes": settings.PRODUCT_VIDEO_MAX_BYTES,
    }


class VideoRejected(Exception):
    """Vídeo enviado não serve (não existe, grande demais, formato errado)."""


def fetch_uploaded_video(product, public_id):
    """Confere no Cloudinary o vídeo que o navegador subiu e devolve a secure_url."""
    import cloudinary.api
    import cloudinary.exceptions

    if not is_product_video_public_id(product, public_id):
        raise VideoRejected("Vídeo inválido para este produto.")
    try:
        res = cloudinary.api.resource(public_id, resource_type="video")
    except cloudinary.exceptions.NotFound:
        raise VideoRejected("Vídeo não encontrado no Cloudinary. Envie novamente.")
    too_big = (res.get("bytes") or 0) > settings.PRODUCT_VIDEO_MAX_BYTES
    if too_big or (res.get("format") or "").lower() not in settings.PRODUCT_VIDEO_FORMATS:
        destroy_video(public_id)
        if too_big:
            raise VideoRejected("Vídeo excede o limite de 50 MB. Comprima ou use um clipe mais curto.")
        raise VideoRejected("Vídeo deve ser MP4, WebM ou MOV.")
    return res["secure_url"]


def upload_video_file(product, video):
    """Caminho multipart (frontend antigo): sobe em pedaços, sem ler o arquivo inteiro."""
    import cloudinary.uploader

    result = cloudinary.uploader.upload_large(
        video,
        resource_type="video",
        public_id=new_video_public_id(product),
        tags=VIDEO_TAG,
        chunk_size=UPLOAD_LARGE_CHUNK_BYTES,
    )
    return result["secure_url"]


def destroy_video(public_id):
    import cloudinary.uploader

    try:
        cloudinary.uploader.destroy(public_id, resource_type="video", invalidate=True)
    except Exception:  # noqa: BLE001 — limpeza é best-effort, nunca derruba o fluxo
        logger.warning("Falha ao apagar vídeo %s no Cloudinary", public_id, exc_info=True)


def destroy_previous_video(product, keep_url=None):
    """Apaga do Cloudinary o vídeo anterior do produto, se foi criado por este fluxo."""
    old = public_id_from_url(product, product.video_external)
    if old and product.video_external != keep_url:
        destroy_video(old)
