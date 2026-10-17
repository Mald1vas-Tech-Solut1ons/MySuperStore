from django.conf import settings
from rest_framework import serializers
from django.utils import timezone

from .models import (
    AttributeValue, Banner, Category, Product, ProductImage,
    ProductSpecification, ProductVariant, ReviewRating, Brand,
)

PROFANITY = {"merda", "bosta", "caralho", "porra", "fuder", "arrombado", "safado", "idiota"}


def get_clean_image_url(image_field, request=None, external_url=None):
    if external_url:
        return external_url
    if not image_field:
        return None
    name = getattr(image_field, "name", "")
    if "dummyjson.com" in name or "unsplash.com" in name or "loremflickr.com" in name or "http" in name:
        clean_name = name.replace("%3A", ":")
        if clean_name.startswith("https:/") and not clean_name.startswith("https://"):
            clean_name = clean_name.replace("https:/", "https://")
        if clean_name.startswith("http:/") and not clean_name.startswith("http://"):
            clean_name = clean_name.replace("http:/", "http://")
        return clean_name
    if request:
        try:
            return request.build_absolute_uri(image_field.url)
        except ValueError:
            return None
    return image_field.url

# -- Atributos -----------------------------------------------------------------

class AttributeValueSerializer(serializers.ModelSerializer):
    attribute_name = serializers.CharField(source="attribute.name", read_only=True)

    class Meta:
        model = AttributeValue
        fields = ["id", "attribute_name", "value"]


# -- Imagens -------------------------------------------------------------------

class ProductImageSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()

    class Meta:
        model = ProductImage
        fields = ["id", "image", "is_primary", "order"]

    def get_image(self, obj):
        return get_clean_image_url(obj.image, self.context.get("request"), getattr(obj, "external_url", None))

class ProductImageUploadSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = ProductImage
        fields = ["id", "image", "image_url", "external_url", "is_primary", "order"]
        extra_kwargs = {
            "image": {"required": False, "allow_null": True},
            "external_url": {"required": False, "allow_null": True},
        }

    def get_image_url(self, obj):
        return get_clean_image_url(obj.image, self.context.get("request"), getattr(obj, "external_url", None))

    def validate_image(self, value):
        # O navegador já comprime (~0,5 MB); estes tetos protegem a API (VM de 1 GB) e o
        # worker do Celery quando a compressão falha ou alguém chama a API direto.
        if value is None:
            return value
        if value.size > settings.PRODUCT_PHOTO_MAX_BYTES:
            raise serializers.ValidationError("Foto passa de 10 MB. Use uma foto menor.")
        # O ImageField do Django já abriu só o cabeçalho com o Pillow (sem decodificar).
        pil = getattr(value, "image", None)
        if pil is not None and pil.size[0] * pil.size[1] > settings.PRODUCT_PHOTO_MAX_PIXELS:
            raise serializers.ValidationError("Foto com resolução alta demais. Use até 40 megapixels.")
        return value


# -- Especificacoes ------------------------------------------------------------

class ProductSpecificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductSpecification
        fields = ["id", "attribute_name", "attribute_value"]


# -- Variantes (leitura) -------------------------------------------------------

class ProductVariantSerializer(serializers.ModelSerializer):
    attributes = AttributeValueSerializer(many=True, read_only=True)
    effective_price = serializers.SerializerMethodField()
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_description = serializers.CharField(source="product.description", read_only=True)
    product_image = serializers.SerializerMethodField()
    product_base_price = serializers.DecimalField(source="product.base_price", read_only=True, max_digits=10, decimal_places=2)
    product_slug = serializers.CharField(source="product.slug", read_only=True)
    seller_max_installments = serializers.SerializerMethodField()

    class Meta:
        model = ProductVariant
        fields = [
            "id", "sku", "attributes", "price", "effective_price", 
            "stock", "is_active", "product_name", "product_description", 
            "product_image", "product_base_price", "product_slug", "seller_max_installments",
            "weight", "length", "width", "height"
        ]

    def get_effective_price(self, obj):
        product = self.context.get("product", obj.product)
        if product and getattr(product, "is_on_sale", False):
            return product.promotional_price
        if obj.price is not None:
            return obj.price
        return product.base_price if product else None

    def get_seller_max_installments(self, obj):
        product = self.context.get("product", obj.product)
        if product and product.seller:
            return product.seller.max_installments
        return 12

    def get_product_image(self, obj):
        request = self.context.get("request")
        if not obj.product:
            return None

        images = getattr(obj.product, "prefetched_images", None)
        if images is None:
            images = list(obj.product.images.all())

        primary = next((i for i in images if i.is_primary), None) or (images[0] if images else None)
        if primary:
            return get_clean_image_url(primary.image, request, getattr(primary, "external_url", None))
        return None


# -- Variantes (escrita) -------------------------------------------------------

class ProductVariantWriteSerializer(serializers.ModelSerializer):
    attributes = serializers.PrimaryKeyRelatedField(
        queryset=AttributeValue.objects.all(), many=True, required=False
    )

    class Meta:
        model = ProductVariant
        fields = ["sku", "attributes", "price", "stock", "is_active", "weight", "length", "width", "height"]

    def validate_sku(self, value):
        qs = ProductVariant.objects.filter(sku=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Este SKU ja esta em uso.")
        return value


class ProductVariantUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductVariant
        fields = ["price", "stock", "is_active", "weight", "length", "width", "height"]


# -- Categorias ----------------------------------------------------------------

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "slug", "description", "image", "parent", "order"]


class CategoryTreeSerializer(serializers.ModelSerializer):
    children = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ["id", "name", "slug", "description", "image", "order", "children"]

    def get_children(self, obj):
        children_map = self.context.get("children_map")
        children = (
            children_map.get(obj.id, [])
            if children_map is not None
            else list(obj.children.filter(is_active=True).order_by("order", "name"))
        )
        return CategoryTreeSerializer(children, many=True, context=self.context).data


# -- Marcas --------------------------------------------------------------------

class BrandSerializer(serializers.ModelSerializer):
    logo = serializers.SerializerMethodField()

    class Meta:
        model = Brand
        fields = ["id", "name", "slug", "logo"]

    def get_logo(self, obj):
        return get_clean_image_url(obj.logo, self.context.get("request"), getattr(obj, "external_url", None))


# -- Reviews -------------------------------------------------------------------

class ReviewSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = ReviewRating
        fields = ["id", "user_name", "rating", "subject", "body", "created_at"]

    def get_user_name(self, obj):
        return obj.user.first_name or obj.user.email.split("@")[0]


class SubmitReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReviewRating
        fields = ["rating", "subject", "body"]

    def validate_rating(self, value):
        if not (1 <= float(value) <= 5):
            raise serializers.ValidationError("A nota deve estar entre 1 e 5.")
        return value

    def validate_body(self, value):
        if value and any(w in value.lower() for w in PROFANITY):
            self._has_profanity = True
        return value

    def create(self, validated_data):
        review_status = "rejected" if getattr(self, "_has_profanity", False) else "approved"
        return ReviewRating.objects.create(**validated_data, status=review_status)


# -- Promocao relampago --------------------------------------------------------

class SetPromoSerializer(serializers.Serializer):
    promotional_price = serializers.DecimalField(
        max_digits=10, decimal_places=2, allow_null=True, required=False
    )
    promo_ends_at = serializers.DateTimeField(allow_null=True, required=False)

    def validate(self, data):
        promo_price = data.get("promotional_price")
        promo_ends = data.get("promo_ends_at")
        if promo_price is not None:
            if promo_ends is None:
                raise serializers.ValidationError(
                    {"promo_ends_at": "Informe a data/hora de termino da promocao."}
                )
            if promo_ends <= timezone.now():
                raise serializers.ValidationError(
                    {"promo_ends_at": "A data de termino deve ser no futuro."}
                )
        return data


# -- Produtos (leitura) --------------------------------------------------------

class ProductListSerializer(serializers.ModelSerializer):
    seller_id = serializers.UUIDField(source="seller.id", read_only=True)
    seller_name = serializers.CharField(source="seller.store_name", read_only=True)
    seller_slug = serializers.CharField(source="seller.slug", read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)
    category_slug = serializers.CharField(source="category.slug", read_only=True)
    brand_slug = serializers.CharField(source="brand.slug", read_only=True)
    primary_image = serializers.SerializerMethodField()
    avg_rating = serializers.FloatField(read_only=True)
    review_count = serializers.IntegerField(read_only=True)
    min_price = serializers.SerializerMethodField()
    is_flash_sale = serializers.SerializerMethodField()
    discount_percentage = serializers.SerializerMethodField()
    time_remaining_seconds = serializers.SerializerMethodField()
    variants = serializers.SerializerMethodField()
    is_demo = serializers.SerializerMethodField()
    is_boosted = serializers.BooleanField(read_only=True)
    carts_count = serializers.IntegerField(read_only=True, default=0)
    has_video = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id", "name", "slug",
            "base_price", "promotional_price", "min_price",
            "is_flash_sale", "discount_percentage", "time_remaining_seconds",
            "seller_id", "seller_name", "seller_slug",
            "category_name", "category_slug", "brand_slug",
            "primary_image",
            "avg_rating", "review_count",
            "is_available", "views_count", "clicks_count", "created_at",
            "variants", "is_free_shipping", "estimated_delivery_days",
            "weight", "length", "width", "height", "is_demo", "carts_count", "is_boosted",
            "has_video",
        ]

    def get_variants(self, obj):
        # A vitrine (ProductViewSet) pré-carrega as variantes ativas em `active_variants`.
        # Sem esse prefetch (lista do lojista, favoritos) mantém o comportamento anterior:
        # todas as variantes do produto.
        variants = getattr(obj, "active_variants", None)
        if variants is None:
            variants = obj.variants.all()
        return ProductVariantSerializer(
            variants, many=True, context={**self.context, "product": obj}
        ).data

    def get_primary_image(self, obj):
        request = self.context.get("request")
        images = getattr(obj, "prefetched_images", None)
        if images is None:
            images = list(obj.images.all())
        primary = next((i for i in images if i.is_primary), None) or (images[0] if images else None)
        if primary:
            return get_clean_image_url(primary.image, request, getattr(primary, "external_url", None))
        return None

    def get_min_price(self, obj):
        if obj.is_on_sale:
            return obj.promotional_price
        variants = getattr(obj, "active_variants", None)
        if variants is None:
            variants = list(obj.variants.filter(is_active=True))
        if not variants:
            return obj.base_price
        prices = [v.price if v.price is not None else obj.base_price for v in variants]
        return min(prices)

    def get_is_flash_sale(self, obj):
        return obj.is_on_sale

    def get_discount_percentage(self, obj):
        if obj.is_on_sale and obj.promotional_price and obj.base_price > 0:
            pct = ((obj.base_price - obj.promotional_price) / obj.base_price) * 100
            return round(float(pct))
        return 0

    def get_time_remaining_seconds(self, obj):
        if obj.is_on_sale and obj.promo_ends_at:
            delta = obj.promo_ends_at - timezone.now()
            secs = delta.total_seconds()
            return int(secs) if secs > 0 else 0
        return 0

    def get_has_video(self, obj):
        # Só um bool na vitrine: a URL do vídeo continua apenas no detalhe.
        return bool(getattr(obj, "video_external", None) or obj.video)

    def get_is_demo(self, obj):
        seller_email = getattr(obj, "seller_email", None)
        if seller_email is None:
            seller_email = obj.seller.user.email if getattr(obj, "seller", None) else ""
        return seller_email in ["loja@nike.com", "loja@samsung.com"]


class ProductDetailSerializer(ProductListSerializer):
    images = ProductImageSerializer(many=True, read_only=True, source="prefetched_images")
    specifications = ProductSpecificationSerializer(many=True, read_only=True)
    variants = serializers.SerializerMethodField()
    reviews = serializers.SerializerMethodField()
    video_url = serializers.SerializerMethodField()
    initial_stock = serializers.SerializerMethodField()

    class Meta(ProductListSerializer.Meta):
        fields = ProductListSerializer.Meta.fields + [
            "description", "images", "specifications", "variants", "reviews",
            "video_url", "meta_title", "meta_description", "approval_status", "updated_at",
            "initial_stock",
        ]

    def get_initial_stock(self, obj):
        # Estoque exibido no formulário simples do vendedor. Para produtos de uma
        # única variante (fluxo padrão do painel), reflete o estoque atual.
        variants = getattr(obj, "active_variants", None)
        if variants is None:
            variants = list(obj.variants.filter(is_active=True))
        return sum(v.stock for v in variants)

    def get_video_url(self, obj):
        request = self.context.get("request")
        if getattr(obj, "video_external", None):
            return obj.video_external
        if obj.video and request:
            return request.build_absolute_uri(obj.video.url)
        return None

    def get_variants(self, obj):
        variants = getattr(obj, "active_variants", None)
        if variants is None:
            variants = list(
                obj.variants.filter(is_active=True).prefetch_related("attributes__attribute")
            )
        return ProductVariantSerializer(
            variants, many=True, context={**self.context, "product": obj}
        ).data

    def get_reviews(self, obj):
        qs = (
            obj.reviews.filter(status="approved")
            .select_related("user")
            .order_by("-created_at")[:20]
        )
        return ReviewSerializer(qs, many=True, context=self.context).data


# -- Produtos (escrita - vendedor) ---------------------------------------------

class ProductSpecificationWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductSpecification
        fields = ["attribute_name", "attribute_value"]

class ProductCreateSerializer(serializers.ModelSerializer):
    slug = serializers.SlugField(required=False, allow_blank=True)
    specifications = ProductSpecificationWriteSerializer(many=True, required=False)

    class Meta:
        model = Product
        fields = [
            "id", "name", "slug", "category", "brand", "description",
            "base_price", "is_available",
            "is_free_shipping", "estimated_delivery_days",
            "weight", "length", "width", "height",
            "meta_title", "meta_description", "specifications"
        ]
        read_only_fields = ["id"]

    def validate_base_price(self, value):
        if value <= 0:
            raise serializers.ValidationError("O preco deve ser maior que zero.")
        return value

    def validate(self, data):
        from django.utils.text import slugify
        slug = data.get("slug", "").strip()
        if not slug:
            base = slugify(data["name"])
            slug, n = base, 1
            while Product.objects.filter(slug=slug).exists():
                slug = f"{base}-{n}"
                n += 1
        elif Product.objects.filter(slug=slug).exists():
            raise serializers.ValidationError({"slug": "Este slug ja esta em uso."})
        data["slug"] = slug
        return data

    def create(self, validated_data):
        specs = validated_data.pop("specifications", [])
        product = super().create(validated_data)
        for spec in specs:
            ProductSpecification.objects.create(product=product, **spec)
        return product


class ProductUpdateSerializer(serializers.ModelSerializer):
    specifications = ProductSpecificationWriteSerializer(many=True, required=False)

    class Meta:
        model = Product
        fields = [
            "name", "category", "brand", "description",
            "base_price", "is_available",
            "is_free_shipping", "estimated_delivery_days",
            "weight", "length", "width", "height",
            "meta_title", "meta_description", "specifications"
        ]

    def validate_base_price(self, value):
        if value <= 0:
            raise serializers.ValidationError("O preco deve ser maior que zero.")
        return value

    def update(self, instance, validated_data):
        specs = validated_data.pop("specifications", None)
        instance = super().update(instance, validated_data)
        if specs is not None:
            instance.specifications.all().delete()
            for spec in specs:
                ProductSpecification.objects.create(product=instance, **spec)
        return instance


# -- Banners -------------------------------------------------------------------

class BannerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Banner
        fields = ["id", "title", "subtitle", "cta_text", "image", "link_url", "order"]
