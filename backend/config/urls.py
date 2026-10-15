from django.conf import settings
from django.contrib import admin
from django.db import connection
from django.http import JsonResponse
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView



def health(request):
    """Liveness/readiness para o Caddy, o healthcheck do Docker e o deploy."""
    try:
        connection.ensure_connection()
    except Exception:
        return JsonResponse({"status": "error", "database": "down"}, status=503)
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("api/health/", health, name="health"),
    path("admin/", admin.site.urls),
    # OpenAPI docs
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    # API v1
    path("api/v1/auth/", include("apps.users.urls.auth")),
    path("api/v1/users/", include("apps.users.urls.users")),
    path("api/v1/sellers/", include("apps.sellers.urls")),
    path("api/v1/assistant/", include("apps.assistant.urls")),
    path("api/v1/catalog/", include("apps.catalog.urls")),
    path("api/v1/cart/", include("apps.carts.urls")),
    path("api/v1/orders/", include("apps.orders.urls")),
    path("api/v1/payments/", include("apps.payments.urls")),
    path("api/v1/admin/", include("apps.admin_api.urls")),
    path("api/v1/crm/", include("apps.crm.urls")),
]

if settings.DEBUG:
    import debug_toolbar
    urlpatterns += [path("__debug__/", include(debug_toolbar.urls))]

# Serve media files in both dev and production (for ephemeral cloud hosting without S3)
from django.urls import re_path
from django.views.static import serve

urlpatterns += [
    re_path(r"^media/(?P<path>.*)$", serve, {"document_root": settings.MEDIA_ROOT}),
]
