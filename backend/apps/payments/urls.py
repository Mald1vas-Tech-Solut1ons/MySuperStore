from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    PaymentViewSet,
    cancel_payment_view,
    confirm_pix_view,
    process_payment_view,
    efi_webhook,
    refund_payment_view,
    simulate_pix_payment_view,
)

app_name = "payments"

router = DefaultRouter()
router.register(r"", PaymentViewSet, basename="payment")

urlpatterns = [
    path("process/", process_payment_view, name="process-payment"),
    # Registrada no Efí como ".../efi-webhook/?hmac=<segredo>&ignorar=" (ver register_efi_webhook):
    # o Efí concatena "/pix" ao fim da URL, que cai dentro do parâmetro "ignorar".
    path("efi-webhook/", efi_webhook, name="efi-webhook"),
    path("<uuid:pk>/confirm-pix/", confirm_pix_view, name="confirm-pix"),
    path("<uuid:pk>/simulate-pix/", simulate_pix_payment_view, name="simulate-pix"),
    path("<uuid:pk>/cancel/", cancel_payment_view, name="cancel-payment"),
    path("<uuid:pk>/refund/", refund_payment_view, name="refund-payment"),
    path("", include(router.urls)),
]
