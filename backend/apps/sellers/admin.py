from django.contrib import admin
from .models import Seller


@admin.register(Seller)
class SellerAdmin(admin.ModelAdmin):
    list_display = (
        "store_name", "user", "status", "featured_rank", "receives_in_master",
        "commission_rate", "efi_payee_code", "created_at",
    )
    list_editable = ("featured_rank",)
    list_filter = ("status", "receives_in_master")
    search_fields = ("store_name", "user__email")
    readonly_fields = ("created_at", "updated_at", "efi_payee_code")
    actions = ["approve_sellers", "suspend_sellers"]

    @admin.action(description="Aprovar vendedores selecionados")
    def approve_sellers(self, request, queryset):
        queryset.update(status="approved")

    @admin.action(description="Suspender vendedores selecionados")
    def suspend_sellers(self, request, queryset):
        queryset.update(status="suspended")
