from django.contrib.auth import get_user_model
from django.utils.text import slugify
from rest_framework import serializers

from .models import Seller, SellerStatus

User = get_user_model()


class SellerPublicSerializer(serializers.ModelSerializer):
    """Perfil público da loja — sem dados sensíveis."""

    logo_url = serializers.SerializerMethodField()
    banner_url = serializers.SerializerMethodField()
    banner2_url = serializers.SerializerMethodField()
    banner3_url = serializers.SerializerMethodField()
    product_count = serializers.SerializerMethodField()
    avg_rating = serializers.SerializerMethodField()
    presentation_video_url = serializers.SerializerMethodField()

    class Meta:
        model = Seller
        fields = [
            "id", "store_name", "slug", "description",
            "logo_url", "banner_url", "banner2_url", "banner3_url", "product_count", "avg_rating", "created_at",
            "primary_color", "video_url", "presentation_video_url", "physical_address", "business_hours",
            "featured_rank",
        ]

    def get_presentation_video_url(self, obj):
        request = self.context.get("request")
        if obj.presentation_video and request:
            return request.build_absolute_uri(obj.presentation_video.url)
        if obj.presentation_video:
            return obj.presentation_video.url
        return None

    def get_logo_url(self, obj):
        request = self.context.get("request")
        if getattr(obj, "logo_external", None):
            return obj.logo_external
        if obj.logo and request:
            return request.build_absolute_uri(obj.logo.url)
        return None

    def get_banner_url(self, obj):
        request = self.context.get("request")
        if getattr(obj, "banner_external", None):
            return obj.banner_external
        if obj.banner and request:
            return request.build_absolute_uri(obj.banner.url)
        return None

    def get_banner2_url(self, obj):
        request = self.context.get("request")
        if getattr(obj, "banner2_external", None):
            return obj.banner2_external
        if obj.banner2 and request:
            return request.build_absolute_uri(obj.banner2.url)
        return None

    def get_banner3_url(self, obj):
        request = self.context.get("request")
        if getattr(obj, "banner3_external", None):
            return obj.banner3_external
        if obj.banner3 and request:
            return request.build_absolute_uri(obj.banner3.url)
        return None

    def get_product_count(self, obj):
        return obj.products.filter(is_available=True).count()

    def get_avg_rating(self, obj):
        from django.db.models import Avg, Q
        rating = obj.products.filter(is_available=True).aggregate(
            avg=Avg("reviews__rating", filter=Q(reviews__status="approved"))
        )["avg"]
        return round(rating, 1) if rating else 0.0


class SellerApplySerializer(serializers.ModelSerializer):
    """Candidatura para se tornar vendedor."""

    cpf_cnpj = serializers.CharField(required=False, allow_blank=True)
    person_type = serializers.ChoiceField(
        choices=Seller._meta.get_field("person_type").choices, required=False
    )
    main_category = serializers.ChoiceField(
        choices=Seller._meta.get_field("main_category").choices, required=False
    )
    efi_payee_code = serializers.CharField(required=True, allow_blank=False, help_text="Identificador de Conta Efí")
    origin_cep = serializers.CharField(required=True, allow_blank=False, help_text="CEP de postagem (Galpão/Loja)")

    class Meta:
        model = Seller
        fields = [
            "store_name", "description", "pix_key", "cpf_cnpj", "person_type",
            "main_category", "efi_payee_code", "origin_cep"
        ]

    def validate_store_name(self, value):
        if Seller.objects.filter(store_name=value).exists():
            raise serializers.ValidationError("Este nome de loja já está em uso.")
        return value

    def validate_cpf_cnpj(self, value):
        # Mantém somente dígitos (o frontend envia formatado)
        return "".join(c for c in (value or "") if c.isdigit())

    def create(self, validated_data):
        user = self.context["request"].user
        validated_data.pop("status", None)

        slug = slugify(validated_data["store_name"])
        base_slug = slug
        n = 1
        while Seller.objects.filter(slug=slug).exists():
            slug = f"{base_slug}-{n}"
            n += 1

        seller = Seller.objects.create(
            user=user,
            slug=slug,
            status=SellerStatus.APPROVED,
            **validated_data,
        )
        user.role = "seller"
        user.save(update_fields=["role"])
        return seller


class SellerDashboardSerializer(serializers.ModelSerializer):
    """Dados do painel do próprio vendedor (autenticado)."""

    total_products = serializers.SerializerMethodField()
    available_products = serializers.SerializerMethodField()
    total_orders = serializers.SerializerMethodField()
    pending_payout = serializers.SerializerMethodField()
    # Campos necessários para o editor da loja (StoreSettingsTab) pré-preencher.
    logo_url = serializers.SerializerMethodField()
    banner_url = serializers.SerializerMethodField()
    banner2_url = serializers.SerializerMethodField()
    banner3_url = serializers.SerializerMethodField()
    presentation_video_url = serializers.SerializerMethodField()

    class Meta:
        model = Seller
        fields = [
            "id", "store_name", "slug", "description", "status", "commission_rate",
            "efi_payee_code", "pix_key",
            "strike_count", "max_installments",
            "primary_color", "video_url", "presentation_video_url", "physical_address", "business_hours",
            "logo_url", "banner_url", "banner2_url", "banner3_url",
            "total_products", "available_products",
            "total_orders", "pending_payout",
        ]

    def get_presentation_video_url(self, obj):
        request = self.context.get("request")
        if obj.presentation_video and request:
            return request.build_absolute_uri(obj.presentation_video.url)
        if obj.presentation_video:
            return obj.presentation_video.url
        return None

    def _img_url(self, obj, field):
        external = getattr(obj, f"{field}_external", None)
        if external:
            return external
        f = getattr(obj, field, None)
        request = self.context.get("request")
        if f and request:
            return request.build_absolute_uri(f.url)
        return None

    def get_logo_url(self, obj):
        return self._img_url(obj, "logo")

    def get_banner_url(self, obj):
        return self._img_url(obj, "banner")

    def get_banner2_url(self, obj):
        return self._img_url(obj, "banner2")

    def get_banner3_url(self, obj):
        return self._img_url(obj, "banner3")

    def get_total_products(self, obj):
        return obj.products.count()

    def get_available_products(self, obj):
        return obj.products.filter(is_available=True).count()

    def get_total_orders(self, obj):
        return obj.sub_orders.count()

    def get_pending_payout(self, obj):
        from apps.payments.models import Payout
        from django.db.models import Sum
        result = Payout.objects.filter(seller=obj, status="pending").aggregate(
            total=Sum("amount")
        )
        return result["total"] or 0


class SellerUpdateSerializer(serializers.ModelSerializer):
    """Atualização do perfil da loja pelo próprio vendedor."""

    # Paleta fixa de cores da loja (rótulo -> hex). Mantém o storefront consistente
    # e evita que o lojista escolha cores ilegíveis/fora do tema.
    STORE_COLORS = {
        "#3B82F6",  # azul
        "#EF4444",  # vermelho
        "#92400E",  # marrom
        "#8B5CF6",  # roxo
        "#EAB308",  # amarelo
        "#F97316",  # laranja
        "#FFFFFF",  # branco
        "#000000",  # preto
        "#22C55E",  # verde
        "#E6B53C",  # dourado (padrão da plataforma)
    }
    MAX_VIDEO_BYTES = 30 * 1024 * 1024  # 30 MB

    class Meta:
        model = Seller
        fields = [
            "store_name", "description", "pix_key", "max_installments", "efi_payee_code",
            "primary_color", "video_url", "presentation_video", "physical_address", "business_hours",
            "logo", "logo_external",
            "banner", "banner_external",
            "banner2", "banner2_external",
            "banner3", "banner3_external",
        ]

    def validate_primary_color(self, value):
        if value and value.upper() not in self.STORE_COLORS:
            raise serializers.ValidationError("Cor inválida. Escolha uma das cores disponíveis.")
        return value.upper() if value else value

    def validate_presentation_video(self, value):
        if value and value.size > self.MAX_VIDEO_BYTES:
            raise serializers.ValidationError("O vídeo excede o limite de 30 MB. Use um clipe mais curto ou comprima.")
        return value


from .models import ChatRoom, ChatMessage

class ChatMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source="sender.first_name", read_only=True)
    sender_email = serializers.CharField(source="sender.email", read_only=True)

    class Meta:
        model = ChatMessage
        fields = ["id", "room", "sender", "sender_name", "sender_email", "message", "is_read", "created_at"]
        read_only_fields = ["id", "sender", "created_at"]


class ChatRoomSerializer(serializers.ModelSerializer):
    customer_email = serializers.CharField(source="customer.email", read_only=True)
    customer_name = serializers.CharField(source="customer.first_name", read_only=True)
    store_name = serializers.CharField(source="seller.store_name", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_slug = serializers.CharField(source="product.slug", read_only=True)
    messages = ChatMessageSerializer(many=True, read_only=True)

    class Meta:
        model = ChatRoom
        fields = [
            "id", "customer", "customer_name", "customer_email",
            "seller", "store_name", "product", "product_name", "product_slug",
            "messages", "created_at", "updated_at"
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class ChatLeadSerializer(serializers.Serializer):
    customer_id = serializers.UUIDField()
    customer_name = serializers.CharField()
    customer_email = serializers.CharField()
    product_id = serializers.UUIDField()
    product_name = serializers.CharField()
    product_slug = serializers.CharField()
    source = serializers.CharField()


from .models import SellerReview, BuyerReview

class SellerReviewSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.first_name", read_only=True)
    
    class Meta:
        model = SellerReview
        fields = ["id", "sub_order", "seller", "customer", "customer_name", "rating", "comment", "created_at"]
        read_only_fields = ["id", "seller", "customer", "created_at"]


class BuyerReviewSerializer(serializers.ModelSerializer):
    seller_name = serializers.CharField(source="seller.store_name", read_only=True)
    
    class Meta:
        model = BuyerReview
        fields = ["id", "sub_order", "seller", "seller_name", "customer", "rating", "comment", "created_at"]
        read_only_fields = ["id", "seller", "customer", "created_at"]


