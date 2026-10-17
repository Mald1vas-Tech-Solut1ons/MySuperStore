import logging

from django.conf import settings
from django.db.models import Avg, Count, F, Prefetch, Q
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.permissions import IsApprovedSeller, IsSeller

from .models import Seller
from .serializers import (
    SellerApplySerializer,
    SellerDashboardSerializer,
    SellerPublicSerializer,
    SellerUpdateSerializer,
)

logger = logging.getLogger(__name__)

# -- Perfil publico ------------------------------------------------------------

class SellerPublicViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Seller.objects.filter(status="approved").select_related("user")
    serializer_class = SellerPublicSerializer
    permission_classes = [permissions.AllowAny]
    lookup_field = "slug"

    def get_queryset(self):
        # Lojas em destaque primeiro (ordem do admin); ?featured=1 traz só elas.
        qs = super().get_queryset().order_by(F("featured_rank").asc(nulls_last=True), "-created_at")
        if self.request.query_params.get("featured") in ("1", "true"):
            qs = qs.filter(featured_rank__isnull=False)
        return qs

# -- Candidatura --------------------------------------------------------------

class SellerApplyView(generics.CreateAPIView):
    serializer_class = SellerApplySerializer
    permission_classes = [permissions.IsAuthenticated]

    def create(self, request, *args, **kwargs):
        # Gate: só abre loja quem confirmou o e-mail (double opt-in no nível da conta).
        if not getattr(request.user, "email_verified_at", None):
            return Response(
                {
                    "detail": "Confirme seu e-mail antes de abrir sua loja. "
                              "Enviamos um link para a sua caixa de entrada.",
                    "code": "email_not_verified",
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        if hasattr(request.user, "seller_profile"):
            return Response(
                {"detail": "Voce ja possui uma loja cadastrada."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        # O status (APPROVED no MVP) e o role são definidos dentro do serializer.
        serializer.save()

# -- Painel do vendedor --------------------------------------------------------

class SellerMeView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsSeller]

    def get_object(self):
        return self.request.user.seller_profile

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return SellerUpdateSerializer
        return SellerDashboardSerializer


# -- CRUD de produtos do vendedor (Fase 3) ------------------------------------

class SellerProductViewSet(viewsets.ModelViewSet):
    """
    GET    /sellers/me/products/           -- lista todos os produtos da loja
    POST   /sellers/me/products/           -- cria novo produto
    GET    /sellers/me/products/{id}/      -- detalhe
    PATCH  /sellers/me/products/{id}/      -- atualiza
    DELETE /sellers/me/products/{id}/      -- remove
    POST   /sellers/me/products/{id}/images/            -- faz upload de imagem
    DELETE /sellers/me/products/{id}/images/{image_id}/ -- remove imagem
    POST   /sellers/me/products/{id}/video/signature/   -- assina upload direto ao Cloudinary
    POST   /sellers/me/products/{id}/video/             -- confirma {public_id} (ou multipart sem Cloudinary)
    POST   /sellers/me/products/{id}/variants/                     -- cria variante
    PATCH  /sellers/me/products/{id}/variants/{variant_id}/        -- atualiza variante
    DELETE /sellers/me/products/{id}/variants/{variant_id}/        -- remove variante
    """

    permission_classes = [IsApprovedSeller]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def _base_queryset(self):
        from apps.catalog.models import Product, ProductImage, ProductVariant
        return (
            Product.objects.filter(seller=self.request.user.seller_profile)
            .select_related("category", "brand")
            .prefetch_related(
                Prefetch(
                    "images",
                    queryset=ProductImage.objects.order_by("order"),
                    to_attr="prefetched_images",
                ),
                Prefetch(
                    "variants",
                    queryset=ProductVariant.objects.filter(is_active=True).prefetch_related(
                        "attributes__attribute"
                    ),
                    to_attr="active_variants",
                ),
            )
            .annotate(
                avg_rating=Avg("reviews__rating", filter=Q(reviews__status="approved")),
                review_count=Count("reviews", filter=Q(reviews__status="approved")),
            )
            .order_by("-created_at")
        )

    def get_queryset(self):
        return self._base_queryset()

    def get_serializer_class(self):
        from apps.catalog.serializers import (
            ProductCreateSerializer,
            ProductDetailSerializer,
            ProductListSerializer,
            ProductUpdateSerializer,
        )
        if self.action == "create":
            return ProductCreateSerializer
        if self.action in ("partial_update", "update"):
            return ProductUpdateSerializer
        if self.action == "retrieve":
            return ProductDetailSerializer
        return ProductListSerializer

    def perform_create(self, serializer):
        product = serializer.save(seller=self.request.user.seller_profile)
        # Garante ao menos uma variante padrão — sem isso o produto não entra no
        # carrinho (o checkout opera sobre variantes). O estoque inicial é opcional.
        from apps.catalog.models import ProductVariant
        if not product.variants.exists():
            try:
                stock = max(0, int(self.request.data.get("initial_stock") or 0))
            except (TypeError, ValueError):
                stock = 0
            ProductVariant.objects.create(
                product=product,
                sku=f"{product.slug[:40]}-{str(product.id)[:8]}",
                stock=stock,
                is_active=True,
            )

    def perform_update(self, serializer):
        product = serializer.save()
        # Aplica o estoque enviado pelo formulário simples do vendedor. Sem isto,
        # editar a quantidade não surtia efeito (o estoque vive na variante, não no
        # Product). Só atua em produtos de variante única — produtos com múltiplas
        # variantes são geridos pelos endpoints de variante.
        if "initial_stock" not in self.request.data:
            return
        from apps.catalog.models import ProductVariant
        try:
            stock = max(0, int(self.request.data.get("initial_stock") or 0))
        except (TypeError, ValueError):
            stock = 0
        variants = list(product.variants.all())
        if len(variants) <= 1:
            variant = variants[0] if variants else None
            if variant:
                variant.stock = stock
                variant.is_active = True
                variant.save(update_fields=["stock", "is_active"])
            else:
                ProductVariant.objects.create(
                    product=product,
                    sku=f"{product.slug[:40]}-{str(product.id)[:8]}",
                    stock=stock,
                    is_active=True,
                )

    def destroy(self, request, *args, **kwargs):
        product = self.get_object()
        # Impede exclusao se houver pedidos associados
        from apps.orders.models import OrderItem
        if OrderItem.objects.filter(variant__product=product).exists():
            return Response(
                {"detail": "Nao e possivel excluir um produto com pedidos. Desative-o em vez disso."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        product.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # -- Imagens --------------------------------------------------------------

    def _get_product(self, pk):
        from apps.catalog.models import Product
        try:
            return Product.objects.get(pk=pk, seller=self.request.user.seller_profile)
        except Product.DoesNotExist:
            from rest_framework.exceptions import NotFound
            raise NotFound("Produto nao encontrado.")

    @action(detail=True, methods=["post"])
    def toggle_boost(self, request, pk=None):
        product = self.get_object()
        product.is_boosted = not getattr(product, "is_boosted", False)
        product.save(update_fields=["is_boosted"])
        return Response({"is_boosted": product.is_boosted})

    # -- Imagens --------------------------------------------------------------

    def _get_product(self, pk):
        from apps.catalog.models import Product
        try:
            return Product.objects.get(pk=pk, seller=self.request.user.seller_profile)
        except Product.DoesNotExist:
            from rest_framework.exceptions import NotFound
            raise NotFound("Produto nao encontrado.")

    MAX_IMAGES_PER_PRODUCT = 6

    def upload_image(self, request, product_pk=None):
        from apps.catalog.serializers import ProductImageUploadSerializer
        product = self._get_product(product_pk)

        # Regra de negócio: no máximo 6 fotos por produto.
        if product.images.count() >= self.MAX_IMAGES_PER_PRODUCT:
            return Response(
                {"detail": f"Limite de {self.MAX_IMAGES_PER_PRODUCT} fotos por produto atingido. "
                           "Remova uma foto para adicionar outra."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ProductImageUploadSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)

        # Primeira imagem vira primaria automaticamente; nova primaria desbanca a anterior
        if serializer.validated_data.get("is_primary") or not product.images.exists():
            product.images.update(is_primary=False)
            serializer.validated_data["is_primary"] = True

        serializer.save(product=product)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def delete_image(self, request, product_pk=None, image_pk=None):
        from apps.catalog.models import ProductImage
        product = self._get_product(product_pk)
        try:
            image = product.images.get(pk=image_pk)
        except ProductImage.DoesNotExist:
            return Response({"detail": "Imagem nao encontrada."}, status=status.HTTP_404_NOT_FOUND)
        was_primary = image.is_primary
        image.delete()
        # Promove a proxima imagem a primaria se a excluida era a principal
        if was_primary:
            next_img = product.images.order_by("order").first()
            if next_img:
                next_img.is_primary = True
                next_img.save(update_fields=["is_primary"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    def set_primary_image(self, request, product_pk=None, image_pk=None):
        from apps.catalog.models import ProductImage
        product = self._get_product(product_pk)
        try:
            image = product.images.get(pk=image_pk)
        except ProductImage.DoesNotExist:
            return Response({"detail": "Imagem nao encontrada."}, status=status.HTTP_404_NOT_FOUND)
        product.images.update(is_primary=False)
        image.is_primary = True
        image.save(update_fields=["is_primary"])
        return Response({"detail": "Foto de capa definida.", "id": str(image.id)})

    # -- Vídeo (máx. 1 por produto) -------------------------------------------
    # Com Cloudinary o navegador sobe o vídeo direto para lá (video_upload_signature) e a
    # API só confirma e grava a URL: os bytes nunca passam pela VM (ver apps/sellers/media.py).

    def video_upload_signature(self, request, product_pk=None):
        from . import media
        product = self._get_product(product_pk)
        if not media.cloudinary_enabled():
            # Dev sem Cloudinary: o frontend cai no envio multipart para a API.
            return Response({"direct": False})
        return Response(media.signed_upload(product))

    def upload_video(self, request, product_pk=None):
        from . import media
        product = self._get_product(product_pk)

        if request.data.get("public_id"):
            if not media.cloudinary_enabled():
                return Response({"detail": "Upload direto indisponível."}, status=status.HTTP_400_BAD_REQUEST)
            try:
                url = media.fetch_uploaded_video(product, str(request.data["public_id"]))
            except media.VideoRejected as exc:
                return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
            except Exception:  # noqa: BLE001
                logger.exception("Falha ao confirmar vídeo do produto %s no Cloudinary", product.pk)
                return Response({"detail": "Não foi possível confirmar o vídeo agora. Tente de novo."},
                                status=status.HTTP_502_BAD_GATEWAY)
            self._replace_video(product, video_external=url)
            return Response({"video_url": url}, status=status.HTTP_201_CREATED)

        video = request.FILES.get("video")
        if not video:
            return Response({"detail": "Nenhum vídeo enviado."}, status=status.HTTP_400_BAD_REQUEST)

        if video.size > settings.PRODUCT_VIDEO_MAX_BYTES:
            return Response(
                {"detail": "Vídeo excede o limite de 50 MB. Comprima ou use um clipe mais curto."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        content_type = (getattr(video, "content_type", "") or "").lower()
        ext = video.name.split('.')[-1].lower() if video.name else ""

        # Muitas vezes o Safari no iOS manda videos como application/octet-stream
        if not content_type.startswith("video/") and ext not in ["mp4", "mov", "webm", "avi", "mkv"]:
            return Response(
                {"detail": f"O arquivo enviado não parece ser um vídeo válido. (Tipo: {content_type}, Extensão: {ext})"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if media.cloudinary_enabled():
            # Frontend antigo (multipart) durante a transição: sobe em pedaços de 6 MB.
            try:
                url = media.upload_video_file(product, video)
            except Exception:  # noqa: BLE001
                logger.exception("Falha ao enviar vídeo do produto %s ao Cloudinary", product.pk)
                return Response({"detail": "Falha ao enviar o vídeo. Tente de novo."},
                                status=status.HTTP_502_BAD_GATEWAY)
            self._replace_video(product, video_external=url)
            return Response({"video_url": url}, status=status.HTTP_201_CREATED)

        self._replace_video(product, video_file=video)
        return Response(
            {"video_url": request.build_absolute_uri(product.video.url)},
            status=status.HTTP_201_CREATED,
        )

    def _replace_video(self, product, video_file=None, video_external=None):
        """Troca o vídeo do produto (mantém o limite de 1), limpando o anterior."""
        from . import media
        if product.video:
            product.video.delete(save=False)
        if media.cloudinary_enabled():
            media.destroy_previous_video(product, keep_url=video_external)
        product.video = video_file
        product.video_external = video_external
        product.save(update_fields=["video", "video_external", "updated_at"])

    def delete_video(self, request, product_pk=None):
        from . import media
        product = self._get_product(product_pk)
        if product.video:
            product.video.delete(save=False)
        if media.cloudinary_enabled():
            media.destroy_previous_video(product)
        product.video = None
        product.video_external = None
        product.save(update_fields=["video", "video_external", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    # -- Variantes ------------------------------------------------------------

    def create_variant(self, request, product_pk=None):
        from apps.catalog.serializers import ProductVariantWriteSerializer
        product = self._get_product(product_pk)
        serializer = ProductVariantWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        variant = serializer.save(product=product)
        # Resposta com leitura completa
        from apps.catalog.serializers import ProductVariantSerializer
        return Response(
            ProductVariantSerializer(variant, context={"product": product}).data,
            status=status.HTTP_201_CREATED,
        )

    def manage_variant(self, request, product_pk=None, variant_pk=None):
        from apps.catalog.models import ProductVariant
        from apps.catalog.serializers import ProductVariantUpdateSerializer, ProductVariantSerializer
        product = self._get_product(product_pk)
        try:
            variant = product.variants.get(pk=variant_pk)
        except ProductVariant.DoesNotExist:
            return Response({"detail": "Variante nao encontrada."}, status=status.HTTP_404_NOT_FOUND)

        if request.method == "DELETE":
            if product.variants.filter(is_active=True).count() <= 1:
                return Response(
                    {"detail": "O produto precisa ter ao menos uma variante ativa."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            variant.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)

        serializer = ProductVariantUpdateSerializer(variant, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            ProductVariantSerializer(variant, context={"product": product}).data
        )


from decimal import Decimal
from datetime import timedelta
from django.utils import timezone
from rest_framework.views import APIView
from apps.carts.models import CartItem
from apps.catalog.models import Wishlist, Product
from .models import ChatRoom, ChatMessage
from .serializers import ChatRoomSerializer, ChatMessageSerializer, ChatLeadSerializer


class SellerMentorView(APIView):
    """
    GET /api/v1/sellers/me/mentor/ — Painel de métricas e sugestões do Mentor de Vendas.
    POST /api/v1/sellers/me/mentor/impulsionar/ — Executa ação de impulsionamento (10% OFF por 7 dias).
    """
    permission_classes = [IsApprovedSeller]

    def get(self, request):
        seller = request.user.seller_profile
        products = Product.objects.filter(seller=seller)

        total_views = sum(p.views_count for p in products)
        total_clicks = sum(p.clicks_count for p in products)

        suggestions = []
        for p in products:
            # Insight 1: Promoção (Muitas views, baixas conversões/cliques)
            if p.views_count >= 5 and p.clicks_count / p.views_count < 0.2:
                suggestions.append({
                    "product_id": str(p.id),
                    "product_name": p.name,
                    "product_slug": p.slug,
                    "type": "promotion",
                    "title": "Impulsionar Vendas (Sugestão de Desconto)",
                    "description": f"O produto '{p.name}' possui {p.views_count} visualizações e apenas {p.clicks_count} cliques. Sugerimos ativar uma promoção de 10% OFF para reter esses clientes!",
                    "action_value": "10",
                })
            # Insight 2: Aumento de Preço (Alta taxa de cliques)
            elif p.views_count >= 5 and p.clicks_count / p.views_count > 0.5:
                suggestions.append({
                    "product_id": str(p.id),
                    "product_name": p.name,
                    "product_slug": p.slug,
                    "type": "price_increase",
                    "title": "Maximizar Lucros (Reajuste de Preço)",
                    "description": f"Excelente! O produto '{p.name}' está com alta demanda ({p.clicks_count} cliques em {p.views_count} acessos). Recomendamos aumentar o preço base em 5% para maximizar seus lucros.",
                    "action_value": "5",
                })

        return Response({
            "store_name": seller.store_name,
            "total_views": total_views,
            "total_clicks": total_clicks,
            "suggestions": suggestions
        })

    def post(self, request):
        # Ação expressa "Impulsionar Vendas"
        action = request.data.get("action")
        product_slug = request.data.get("product_slug")
        if not product_slug:
            return Response({"detail": "product_slug é obrigatório."}, status=400)

        try:
            product = Product.objects.get(slug=product_slug, seller=request.user.seller_profile)
        except Product.DoesNotExist:
            return Response({"detail": "Produto não encontrado."}, status=404)

        if action == "promotion":
            # Aplica 10% de desconto
            product.promotional_price = product.base_price * Decimal("0.90")
            product.promo_starts_at = timezone.now()
            product.promo_ends_at = timezone.now() + timedelta(days=7)
            product.save()
            return Response({
                "detail": f"Oferta relâmpago de 10% OFF ativada com sucesso para '{product.name}'!",
                "promotional_price": product.promotional_price
            })
        elif action == "price_increase":
            # Aumenta 5%
            product.base_price = product.base_price * Decimal("1.05")
            product.save()
            return Response({
                "detail": f"Preço base do produto '{product.name}' reajustado em +5% com sucesso!",
                "base_price": product.base_price
            })

        return Response({"detail": "Ação inválida."}, status=400)


class SellerLeadsView(APIView):
    """
    GET /api/v1/sellers/me/leads/ — Listagem de clientes com intenção de compra.
    """
    permission_classes = [IsApprovedSeller]

    def get(self, request):
        seller = request.user.seller_profile
        
        # Carrinhos com produtos do vendedor
        cart_items = CartItem.objects.filter(
            variant__product__seller=seller,
            cart__user__isnull=False
        ).select_related("cart__user", "variant__product")

        # Favoritos com produtos do vendedor
        wishlists = Wishlist.objects.filter(
            products__seller=seller
        ).prefetch_related("products", "user")

        leads = []
        seen = set()

        for item in cart_items:
            key = (item.cart.user.id, item.variant.product.id)
            if key not in seen:
                seen.add(key)
                leads.append({
                    "customer_id": str(item.cart.user.id),
                    "customer_name": item.cart.user.first_name or item.cart.user.email.split("@")[0],
                    "customer_email": item.cart.user.email,
                    "product_id": str(item.variant.product.id),
                    "product_name": item.variant.product.name,
                    "product_slug": item.variant.product.slug,
                    "source": "carrinho"
                })

        for wl in wishlists:
            for p in wl.products.filter(seller=seller):
                key = (wl.user.id, p.id)
                if key not in seen:
                    seen.add(key)
                    leads.append({
                        "customer_id": str(wl.user.id),
                        "customer_name": wl.user.first_name or wl.user.email.split("@")[0],
                        "customer_email": wl.user.email,
                        "product_id": str(p.id),
                        "product_name": p.name,
                        "product_slug": p.slug,
                        "source": "favoritos"
                    })

        return Response(leads)


class ChatRoomViewSet(viewsets.ModelViewSet):
    """
    ViewSet unificado para gerenciar salas e mensagens de chat.
    Suporta listagem de salas para comprador e vendedor, criação e envio de mensagens.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ChatRoomSerializer

    def get_queryset(self):
        user = self.request.user
        qs = ChatRoom.objects.all()
        if hasattr(user, "seller_profile"):
            qs = qs.filter(Q(customer=user) | Q(seller=user.seller_profile))
        else:
            qs = qs.filter(customer=user)
        return qs.prefetch_related("messages__sender")

    @action(detail=False, methods=["post"], url_path="create")
    def create_room(self, request):
        """
        POST /api/v1/sellers/me/chats/create/
        Cria uma sala se ela não existir.
        """
        product_id = request.data.get("product_id")
        product = None
        if product_id:
            product = Product.objects.filter(id=product_id).first()

        customer_id = request.data.get("customer_id")
        if customer_id and hasattr(request.user, "seller_profile"):
            from django.contrib.auth import get_user_model
            customer = get_user_model().objects.get(id=customer_id)
            seller = request.user.seller_profile
        else:
            customer = request.user
            seller_id = request.data.get("seller_id")
            if not seller_id and product:
                seller = product.seller
            else:
                seller = Seller.objects.get(id=seller_id)

        room, created = ChatRoom.objects.get_or_create(
            customer=customer,
            seller=seller,
            product=product
        )
        return Response(ChatRoomSerializer(room, context={"request": request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="messages")
    def send_message(self, request, pk=None):
        """
        POST /api/v1/sellers/me/chats/{id}/messages/
        """
        room = self.get_object()
        msg_text = request.data.get("message")
        if not msg_text:
            return Response({"detail": "message é obrigatório."}, status=status.HTTP_400_BAD_REQUEST)

        message = ChatMessage.objects.create(
            room=room,
            sender=request.user,
            message=msg_text
        )
        room.save(update_fields=["updated_at"])
        
        # Disparar notificação para a outra parte
        target_user = room.customer if request.user.id == room.seller.user.id else room.seller.user
        from apps.users.models import Notification
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        
        notif = Notification.objects.create(
            user=target_user,
            title=f"Nova mensagem de {request.user.first_name or request.user.email}",
            message=msg_text[:50] + ("..." if len(msg_text) > 50 else ""),
            type="chat",
            related_entity_id=str(room.id)
        )
        
        channel_layer = get_channel_layer()
        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                f"user_{target_user.id}_notifications",
                {
                    "type": "send_notification",
                    "data": {
                        "id": str(notif.id),
                        "title": notif.title,
                        "message": notif.message,
                        "type": notif.type,
                        "related_entity_id": notif.related_entity_id,
                        "is_read": False,
                        "created_at": notif.created_at.isoformat()
                    }
                }
            )

        return Response(ChatMessageSerializer(message).data, status=status.HTTP_201_CREATED)


from django.db.models.functions import TruncDate
from django.db.models import Sum, Count, Avg
from django.utils import timezone
from datetime import timedelta
from apps.orders.models import SubOrder, OrderItem, OrderStatus

class SellerAnalyticsView(APIView):
    """
    GET /api/v1/sellers/me/analytics/
    Retorna métricas para o Dashboard Lojista: GMV, Conversão, Top Produtos.
    """
    permission_classes = [IsApprovedSeller]

    def get(self, request):
        seller = request.user.seller_profile
        
        # 1. KPIs
        valid_statuses = [OrderStatus.CONFIRMED, OrderStatus.PROCESSING, OrderStatus.SHIPPED, OrderStatus.DELIVERED]
        sub_orders = SubOrder.objects.filter(seller=seller, status__in=valid_statuses)
        total_revenue = sub_orders.aggregate(total=Sum("seller_amount"))["total"] or 0
        total_orders = sub_orders.count()
        avg_ticket = (total_revenue / total_orders) if total_orders > 0 else 0
        
        # 1.5 View KPIs
        from apps.catalog.models import Product
        seller_products = Product.objects.filter(seller=seller)
        views_aggr = seller_products.aggregate(total_views=Sum("views_count"), total_clicks=Sum("clicks_count"))
        total_views = views_aggr["total_views"] or 0
        total_clicks = views_aggr["total_clicks"] or 0
        
        # 2. Sales Over Time (Last 30 days)
        thirty_days_ago = timezone.now() - timedelta(days=30)
        sales_over_time = sub_orders.filter(created_at__gte=thirty_days_ago) \
            .annotate(date=TruncDate("created_at")) \
            .values("date") \
            .annotate(revenue=Sum("seller_amount"), orders=Count("id")) \
            .order_by("date")
            
        # 3. Top Products
        top_items = OrderItem.objects.filter(sub_order__seller=seller, sub_order__status__in=valid_statuses) \
            .values("product_name") \
            .annotate(revenue=Sum("total"), quantity=Sum("quantity")) \
            .order_by("-revenue")[:5]

        # 3.5 Most Viewed Products
        most_viewed = seller_products.filter(views_count__gt=0).values("name", "views_count", "clicks_count", "slug").order_by("-views_count")[:5]

        # 4. Reputation
        from .models import SellerReview
        reviews = SellerReview.objects.filter(seller=seller)
        avg_rating = reviews.aggregate(avg=Avg("rating"))["avg"] or 0
        review_count = reviews.count()

        return Response({
            "kpis": {
                "total_revenue": total_revenue,
                "total_orders": total_orders,
                "avg_ticket": avg_ticket,
                "total_views": total_views,
                "total_clicks": total_clicks,
            },
            "sales_over_time": list(sales_over_time),
            "top_products": list(top_items),
            "most_viewed_products": list(most_viewed),
            "reputation": {
                "avg_rating": round(avg_rating, 1),
                "review_count": review_count
            }
        })


from .serializers import SellerReviewSerializer, BuyerReviewSerializer
from .models import SellerReview, BuyerReview

class SellerReviewViewSet(viewsets.ModelViewSet):
    """
    Cliente avaliando Lojista ou Lojista lendo suas avaliações.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = SellerReviewSerializer

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, "seller_profile"):
            return SellerReview.objects.filter(seller=user.seller_profile)
        return SellerReview.objects.filter(customer=user)

    def perform_create(self, serializer):
        from rest_framework.exceptions import ValidationError
        sub_order = serializer.validated_data.get("sub_order")
        if sub_order.order.user != self.request.user:
            raise ValidationError("Você só pode avaliar lojistas de seus próprios pedidos.")
        serializer.save(customer=self.request.user, seller=sub_order.seller)


class BuyerReviewViewSet(viewsets.ModelViewSet):
    """
    Lojista avaliando Cliente ou Cliente lendo suas avaliações.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = BuyerReviewSerializer

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, "seller_profile"):
            return BuyerReview.objects.filter(seller=user.seller_profile)
        return BuyerReview.objects.filter(customer=user)

    def perform_create(self, serializer):
        from rest_framework.exceptions import ValidationError
        if not hasattr(self.request.user, "seller_profile"):
            raise ValidationError("Apenas lojistas podem avaliar compradores.")
        sub_order = serializer.validated_data.get("sub_order")
        if sub_order.seller != self.request.user.seller_profile:
            raise ValidationError("Você só pode avaliar compradores de seus próprios pedidos.")
        serializer.save(seller=self.request.user.seller_profile, customer=sub_order.order.user)

