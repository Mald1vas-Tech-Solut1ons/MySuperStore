import io
import os
from celery import shared_task
from django.core.files.base import ContentFile
from PIL import Image
from .models import ProductImage


@shared_task
def optimize_product_image_task(product_image_id):
    try:
        product_image = ProductImage.objects.get(id=product_image_id)
    except ProductImage.DoesNotExist:
        return f"Imagem de produto {product_image_id} não encontrada."

    # Carrega a imagem original do storage (local ou S3)
    img_field = product_image.image
    try:
        img_field.open("rb")
        img_data = img_field.read()
    except Exception as e:
        return f"Erro ao ler imagem original do storage: {str(e)}"
    finally:
        img_field.close()

    # Processamento de imagem com a biblioteca Pillow
    try:
        image = Image.open(io.BytesIO(img_data))
        # Já é WebP no tamanho final: nada a fazer (decidido pelo conteúdo, não pelo nome).
        if image.format == "WEBP" and max(image.size) <= 1200:
            return f"Imagem {product_image.id} já está otimizada."
        
        # Converte para RGB se necessário (WebP suporta RGB e RGBA)
        if image.mode not in ("RGB", "RGBA"):
            image = image.convert("RGB")

        # Redimensiona mantendo a proporção (thumbnail) com tamanho máximo de 1200px
        image.thumbnail((1200, 1200))

        # Salva a imagem comprimida em formato WebP no buffer
        output_buffer = io.BytesIO()
        image.save(output_buffer, format="WEBP", quality=80)
        output_buffer.seek(0)
    except Exception as e:
        return f"Erro ao processar imagem com Pillow: {str(e)}"

    # Define o novo nome do arquivo com a extensão .webp
    original_filename = os.path.basename(img_field.name)
    base_name, _ = os.path.splitext(original_filename)
    new_filename = f"{base_name}.webp"

    # Salva o arquivo WebP de volta no model
    # Nota: save=False para evitar o gatilho recursivo do signal. Atualizamos via queryset
    optimized_file = ContentFile(output_buffer.read(), name=new_filename)
    
    old_name = img_field.name
    # Grava o novo arquivo e atualiza o banco via queryset: .save() no model dispararia
    # o post_save de novo (era a origem do loop). Só então apaga o original.
    product_image.image.save(new_filename, optimized_file, save=False)
    ProductImage.objects.filter(pk=product_image.pk).update(image=product_image.image.name)
    if old_name and old_name != product_image.image.name:
        try:
            img_field.storage.delete(old_name)
        except Exception:
            pass

    return f"Imagem {product_image.id} otimizada com sucesso para WebP (Pedido: {new_filename})"
