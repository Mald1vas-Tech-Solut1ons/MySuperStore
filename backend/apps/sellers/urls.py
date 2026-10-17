from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    SellerApplyView,
    SellerMeView,
    SellerProductViewSet,
    SellerPublicViewSet,
    SellerMentorView,
    SellerLeadsView,
    ChatRoomViewSet,
    SellerAnalyticsView,
    SellerReviewViewSet,
    BuyerReviewViewSet,
)

router = DefaultRouter()
router.register("me/chats", ChatRoomViewSet, basename="seller-chats")
router.register("me/reviews-received", SellerReviewViewSet, basename="seller-reviews")
router.register("me/reviews-given", BuyerReviewViewSet, basename="buyer-reviews")
router.register("", SellerPublicViewSet, basename="seller")

# ViewSet instanciado uma vez para as rotas manuais aninhadas
_products = SellerProductViewSet.as_view

urlpatterns = [
    # Candidatura
    path("apply/", SellerApplyView.as_view(), name="seller-apply"),

    # Painel do vendedor
    path("me/", SellerMeView.as_view(), name="seller-me"),

    # Analytics Dashboard
    path("me/analytics/", SellerAnalyticsView.as_view(), name="seller-analytics"),

    # Mentor & Leads
    path("me/mentor/", SellerMentorView.as_view(), name="seller-mentor"),
    path("me/leads/", SellerLeadsView.as_view(), name="seller-leads"),


    # ---- CRUD de produtos do vendedor (Fase 3) ----
    path(
        "me/products/",
        _products({"get": "list", "post": "create"}),
        name="seller-products",
    ),
    path(
        "me/products/<uuid:pk>/",
        _products({"get": "retrieve", "patch": "partial_update", "delete": "destroy"}),
        name="seller-product-detail",
    ),
    # Imagens
    path(
        "me/products/<uuid:product_pk>/images/",
        _products({"post": "upload_image"}),
        name="seller-product-images",
    ),
    path(
        "me/products/<uuid:product_pk>/images/<uuid:image_pk>/",
        _products({"delete": "delete_image"}),
        name="seller-product-image-delete",
    ),
    path(
        "me/products/<uuid:product_pk>/images/<uuid:image_pk>/primary/",
        _products({"post": "set_primary_image"}),
        name="seller-product-image-primary",
    ),
    # Vídeo (máx. 1 por produto)
    path(
        "me/products/<uuid:product_pk>/video/",
        _products({"post": "upload_video", "delete": "delete_video"}),
        name="seller-product-video",
    ),
    path(
        "me/products/<uuid:product_pk>/video/signature/",
        _products({"post": "video_upload_signature"}),
        name="seller-product-video-signature",
    ),
    # Impulsionar Produto
    path(
        "me/products/<uuid:pk>/toggle_boost/",
        _products({"post": "toggle_boost"}),
        name="seller-product-toggle-boost",
    ),
    # Variantes
    path(
        "me/products/<uuid:product_pk>/variants/",
        _products({"post": "create_variant"}),
        name="seller-product-variants",
    ),
    path(
        "me/products/<uuid:product_pk>/variants/<uuid:variant_pk>/",
        _products({"patch": "manage_variant", "delete": "manage_variant"}),
        name="seller-product-variant-detail",
    ),

    # Perfis publicos (router padrao)
    path("", include(router.urls)),
]
