import logging

from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import ProductImage
from .tasks import optimize_product_image_task

logger = logging.getLogger(__name__)


@receiver(post_save, sender=ProductImage)
def optimize_product_image_on_save(sender, instance, created, **kwargs):
    """
    Sinal post_save para otimizar e converter a imagem do produto para WebP em background.
    """
    # Só em imagem recém-criada. Storages como o Cloudinary guardam o nome SEM extensão,
    # então checar ".webp" pelo nome disparava a otimização a cada save — loop infinito
    # que renomeava e apagava o arquivo. O formato real é checado na task (Pillow).
    if created and instance.image:
        image_id = str(instance.id)

        def _enqueue():
            # A otimização é um "nice-to-have" em background. Se o broker (Redis) estiver
            # indisponível, NUNCA deve derrubar o upload do lojista — apenas registra.
            try:
                optimize_product_image_task.delay(image_id)
            except Exception as exc:  # noqa: BLE001
                logger.warning("Falha ao enfileirar otimização da imagem %s: %s", image_id, exc)

        # on_commit garante que o registro já exista no banco para o worker do Celery
        transaction.on_commit(_enqueue)
