import os
from django.core.asgi import get_asgi_application

from config.daphne_patches import patch_daphne

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.prod")
# Antes de qualquer request: sem parse duplicado do multipart e com teto de corpo (413).
patch_daphne()

django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter
from apps.sellers.routing import websocket_urlpatterns
from apps.sellers.middleware import JWTAuthMiddlewareStack

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": JWTAuthMiddlewareStack(
        URLRouter(websocket_urlpatterns)
    ),
})
