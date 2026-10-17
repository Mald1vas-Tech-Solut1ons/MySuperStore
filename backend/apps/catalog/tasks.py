import io
import os
from celery import shared_task
from django.core.files.base import ContentFile
from PIL import Image, ImageOps
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

        # Reduz ANTES de converter, e com draft explícito: o JPEG já é decodificado em
        # escala menor (12 MP → 2000x1500), sem materializar a foto inteira no worker.
        # (O thumbnail sozinho só usa draft com folga de 2x, que 12 MP→1200px não tem.)
        # Pico medido numa foto de 12 MP: RGB 65→24 MB, CMYK 93→24 MB, cinza 65→16 MB.
        image.draft(None, (1200, 1200))
        image.thumbnail((1200, 1200))
        # Foto de celular sem a compressão do navegador vem deitada + tag EXIF de rotação;
        # o WebP gerado não leva o EXIF, então aplica a rotação nos pixels.
        image = ImageOps.exif_transpose(image)

        # Converte se necessário (WebP suporta RGB e RGBA)
        if image.mode not in ("RGB", "RGBA"):
            image = image.convert("RGBA" if image.mode in ("P", "LA", "PA") else "RGB")

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
