from collections import defaultdict

from django.db.models import Avg, Count, Prefetch, Q
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .filters import ProductFilter
from .models import Banner, Category, Product, ProductImage, ProductVariant, ReviewRating, Brand, Wishlist
from .serializers import (
    BannerSerializer,
    CategorySerializer,
    CategoryTreeSerializer,
    ProductDetailSerializer,
    ProductListSerializer,
    ReviewSerializer,
    SetPromoSerializer,
    SubmitReviewSerializer,
    BrandSerializer,
)


# -- Categorias ----------------------------------------------------------------

class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Category.objects.filter(is_active=True).order_by("order", "name")
    serializer_class = CategorySerializer
    permission_classes = [permissions.AllowAny]
    lookup_field = "slug"
    pagination_class = None

    @action(detail=False, methods=["get"], url_path="tree")
    def tree(self, request):
        """GET /catalog/categories/tree/ -- arvore hierarquica sem N+1."""
        categories = list(self.get_queryset())
        children_map = defaultdict(list)
        for cat in categories:
            if cat.parent_id is not None:
                children_map[cat.parent_id].append(cat)
        roots = [cat for cat in categories if cat.parent_id is None]
        serializer = CategoryTreeSerializer(
            roots, many=True, context={"request": request, "children_map": children_map}
        )
        return Response(serializer.data)


# -- Marcas --------------------------------------------------------------------

class BrandViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Brand.objects.all().order_by("name")
    serializer_class = BrandSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None


# -- Produtos (vitrine publica) ------------------------------------------------

class ProductViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [permissions.AllowAny]
    filterset_class = ProductFilter
    search_fields = ["name", "description"]
    ordering_fields = ["base_price", "created_at", "avg_rating", "review_count"]
    lookup_field = "slug"

    def get_queryset(self):
        qs = (
            Product.objects.filter(is_available=True, seller__status="approved")
            .select_related("seller", "category", "brand")
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
                review_count=Count("reviews", filter=Q(reviews__status="approved"), distinct=True),
            )
        )
        user = self.request.user
        
        # Obter recentes via query params (enviados pelo frontend)
        recent_categories = self.request.query_params.get("recent_categories", "")
        recent_searches = self.request.query_params.get("recent_searches", "")

        from django.db.models import Case, When, Value, IntegerField
        conditions = []

        if user and user.is_authenticated and hasattr(user, "survey"):
            survey = user.survey
            if getattr(survey, "preferred_category", None):
                conditions.append(When(category__name__icontains=survey.preferred_category, then=Value(10)))
            if getattr(survey, "preferred_brand", None):
                conditions.append(When(brand__name__icontains=survey.preferred_brand, then=Value(8)))
        
        # Histórico recente pesa, mas um pouco menos que a preferência declarada
        if recent_categories:
            for cat in recent_categories.split(","):
                cat = cat.strip()
                if cat:
                    conditions.append(When(category__name__icontains=cat, then=Value(6)))
        
        if recent_searches:
            for search in recent_searches.split(","):
                search = search.strip()
                if search:
                    conditions.append(When(name__icontains=search, then=Value(7)))
                    conditions.append(When(description__icontains=search, then=Value(4)))

        if conditions:
            qs = qs.annotate(
                relevance=Case(*conditions, default=Value(0), output_field=IntegerField())
            )
            ordering = self.request.query_params.get("ordering", "relevance")
            if ordering == "relevance":
                return qs.order_by("-is_boosted", "-relevance", "-created_at")
            return qs.order_by("-created_at")
        else:
            qs = qs.order_by("-is_boosted", "-created_at")
            
        return qs

    def get_serializer_class(self):
        if self.action == "retrieve":
            return ProductDetailSerializer
        return ProductListSerializer

    # -- Tracking --------------------------------------------------------------

    @action(detail=True, methods=["post"], url_path="track")
    def track(self, request, slug=None):
        """
        POST /catalog/products/{slug}/track/
        Body: { "type": "view" | "click" }
        """
        product = self.get_object()
        interaction_type = request.data.get("type", "view")
        if interaction_type == "click":
            product.clicks_count += 1
            product.save(update_fields=["clicks_count"])
        else:
            product.views_count += 1
            product.save(update_fields=["views_count"])
        return Response({"views": product.views_count, "clicks": product.clicks_count})

    # -- Reviews ---------------------------------------------------------------

    @action(detail=True, methods=["get", "post"], url_path="reviews")
    def reviews(self, request, slug=None):
        """
        GET  -- lista avaliacoes aprovadas (publico)
        POST -- envia avaliacao (autenticado)
        """
        product = self.get_object()

        if request.method == "POST":
            if not request.user.is_authenticated:
                return Response(
                    {"detail": "Autenticacao necessaria para avaliar."},
                    status=status.HTTP_401_UNAUTHORIZED,
                )
            if ReviewRating.objects.filter(product=product, user=request.user).exists():
                return Response(
                    {"detail": "Voce ja avaliou este produto."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            serializer = SubmitReviewSerializer(
                data=request.data, context={"request": request}
            )
            serializer.is_valid(raise_exception=True)
            serializer.save(product=product, user=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        qs = (
            ReviewRating.objects.filter(product=product, status="approved")
            .select_related("user")
            .order_by("-created_at")
        )
        serializer = ReviewSerializer(qs, many=True, context={"request": request})
        return Response(serializer.data)

    # -- Promocao relampago (lojista) -----------------------------------------

    @action(detail=True, methods=["patch"], url_path="set-promo")
    def set_promo(self, request, slug=None):
        """
        PATCH /catalog/products/{slug}/set-promo/
        Lojista ativa ou desativa oferta relampago no proprio produto.
        Envie promotional_price=null para cancelar a promocao.
        """
        if not request.user.is_authenticated or not hasattr(request.user, "seller_profile"):
            return Response(
                {"detail": "Apenas lojistas podem criar promocoes."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Busca sem filtro de disponibilidade -- lojista pode promover rascunhos
        try:
            product = Product.objects.get(
                slug=slug, seller=request.user.seller_profile
            )
        except Product.DoesNotExist:
            return Response(
                {"detail": "Produto nao encontrado ou nao pertence a sua loja."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = SetPromoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        promo_price = data.get("promotional_price")
        if promo_price is not None:
            if promo_price >= product.base_price:
                return Response(
                    {"detail": "O preco promocional deve ser menor que o preco base."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            product.promotional_price = promo_price
            product.promo_starts_at = timezone.now()
            product.promo_ends_at = data["promo_ends_at"]
        else:
            # Cancela a promocao
            product.promotional_price = None
            product.promo_starts_at = None
            product.promo_ends_at = None

        product.save(update_fields=["promotional_price", "promo_starts_at", "promo_ends_at"])

        # Notificar usuários que têm este produto na Wishlist!
        if promo_price is not None:
            from apps.users.models import Notification
            from channels.layers import get_channel_layer
            from asgiref.sync import async_to_sync
            
            wishlist_users = [w.user for w in product.wishlists.select_related("user").all()]
            channel_layer = get_channel_layer()
            
            for u in wishlist_users:
                notif = Notification.objects.create(
                    user=u,
                    title="🔥 Oferta no seu Favorito!",
                    message=f"O produto {product.name} que você favoritou acaba de entrar em Super Oferta! Aproveite.",
                    type="promo",
                    related_entity_id=product.slug
                )
                async_to_sync(channel_layer.group_send)(
                    f"user_{u.id}_notifications",
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
        return Response(
            {
                "detail": "Promocao atualizada.",
                "is_flash_sale": product.is_on_sale,
                "promotional_price": product.promotional_price,
                "promo_ends_at": product.promo_ends_at,
            }
        )


# -- Banners -------------------------------------------------------------------

class BannerViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Banner.objects.filter(active=True).order_by("order")
    serializer_class = BannerSerializer
    permission_classes = [permissions.AllowAny]


# -- Favoritos (Wishlist) ------------------------------------------------------

class WishlistViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=["get"], url_path="my")
    def my(self, request):
        wishlist, _ = Wishlist.objects.get_or_create(user=request.user)
        serializer = ProductListSerializer(wishlist.products.all(), many=True, context={"request": request})
        return Response(serializer.data)

    @action(detail=False, methods=["post"], url_path="add")
    def add(self, request):
        product_id = request.data.get("product_id")
        try:
            product = Product.objects.get(id=product_id)
        except Product.DoesNotExist:
            return Response({"detail": "Produto não encontrado."}, status=404)
            
        wishlist, _ = Wishlist.objects.get_or_create(user=request.user)
        wishlist.products.add(product)
        return Response({"success": True})

    @action(detail=False, methods=["post"], url_path="remove")
    def remove(self, request):
        product_id = request.data.get("product_id")
        try:
            product = Product.objects.get(id=product_id)
        except Product.DoesNotExist:
            return Response({"detail": "Produto não encontrado."}, status=404)
            
        wishlist, _ = Wishlist.objects.get_or_create(user=request.user)
        wishlist.products.remove(product)
        return Response({"success": True})
    pagination_class = None
