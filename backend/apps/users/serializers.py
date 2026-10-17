import os
import uuid

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

User = get_user_model()


# ── Register ─────────────────────────────────────────────────────────────────

class UserRegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ["email", "person_type", "cpf_cnpj", "first_name", "last_name", "phone", "role", "password", "password_confirm"]

    def validate_cpf_cnpj(self, value):
        if value and User.objects.filter(cpf_cnpj=value).exists():
            raise serializers.ValidationError("Este CPF/CNPJ já está vinculado a outra conta.")
        return value

    def validate_phone(self, value):
        if value and User.objects.filter(phone=value).exists():
            raise serializers.ValidationError("Este telefone já está registrado.")
        return value

    def validate(self, data):
        from .utils import validate_cpf, validate_cnpj
        
        cpf_cnpj = data.get("cpf_cnpj", "")
        person_type = data.get("person_type", "PF")
        
        if person_type == "PF":
            if not validate_cpf(cpf_cnpj):
                raise serializers.ValidationError({"cpf_cnpj": "CPF inválido."})
        elif person_type == "PJ":
            if not validate_cnpj(cpf_cnpj):
                raise serializers.ValidationError({"cpf_cnpj": "CNPJ inválido."})
            
        if data.get("password") != data.pop("password_confirm", None):
            raise serializers.ValidationError({"password_confirm": "As senhas não conferem."})
        return data

    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        # Em dev: ativa e verifica automaticamente
        # Em prod: descomente/mantenha o envio de e-mail de verificação real
        from django.conf import settings
        if settings.DEBUG:
            from django.utils import timezone
            user.is_active = True
            user.email_verified_at = timezone.now()
            user.save(update_fields=["is_active", "email_verified_at"])
        else:
            user.is_active = True
            user.save(update_fields=["is_active"])
        return user


# ── Custom JWT claim ─────────────────────────────────────────────────────────

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Adiciona email, full_name e role ao payload do JWT."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["email"] = user.email
        token["full_name"] = user.full_name
        token["role"] = user.role
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UserProfileSerializer(self.user).data
        return data


# ── Profile ──────────────────────────────────────────────────────────────────

class UserProfileSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    avatar_url = serializers.SerializerMethodField()
    # Flags de perfil — usados pelo frontend para liberar o Painel do Lojista
    has_store = serializers.SerializerMethodField()
    has_products = serializers.SerializerMethodField()
    is_seller = serializers.SerializerMethodField()
    efi_payee_code = serializers.SerializerMethodField()
    email_verified = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "email", "person_type", "cpf_cnpj", "first_name", "last_name",
            "phone", "role", "full_name", "avatar_url", "has_store", "has_products",
            "is_seller", "efi_payee_code",
            "email_verified", "is_active", "date_joined",
        ]
        read_only_fields = [
            "id", "email", "person_type", "cpf_cnpj", "role",
            "has_store", "has_products", "is_seller", "efi_payee_code",
            "email_verified", "is_active", "date_joined",
        ]

    def get_email_verified(self, obj):
        return bool(getattr(obj, "email_verified_at", None))

    def get_avatar_url(self, obj):
        request = self.context.get("request")
        if obj.avatar:
            url = obj.avatar.url
            return request.build_absolute_uri(url) if request else url
        # Legado: linhas ainda não migradas (manage.py migrate_avatars) guardam a foto em base64.
        if getattr(obj, "avatar_base64", None):
            return obj.avatar_base64
        return None

    def get_has_store(self, obj):
        """True se o usuário é vendedor com loja aprovada."""
        seller = getattr(obj, "seller_profile", None)
        return bool(seller and seller.status == "approved")

    def get_has_products(self, obj):
        """True se a loja do vendedor já possui ao menos um produto."""
        seller = getattr(obj, "seller_profile", None)
        return bool(seller and seller.products.exists())

    def get_is_seller(self, obj):
        return obj.role == "seller" or hasattr(obj, "seller_profile")

    def get_efi_payee_code(self, obj):
        seller = getattr(obj, "seller_profile", None)
        return seller.efi_payee_code if seller else None


class UserProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["first_name", "last_name", "phone", "avatar"]

    def validate_avatar(self, value):
        # Mesmos tetos das fotos de produto (protegem a API e o armazenamento).
        if value is None:
            return value
        if value.size > settings.PRODUCT_PHOTO_MAX_BYTES:
            raise serializers.ValidationError("Foto passa de 10 MB. Use uma foto menor.")
        pil = getattr(value, "image", None)
        if pil is not None and pil.size[0] * pil.size[1] > settings.PRODUCT_PHOTO_MAX_PIXELS:
            raise serializers.ValidationError("Foto com resolução alta demais. Use até 40 megapixels.")
        return value

    def update(self, instance, validated_data):
        if "avatar" in validated_data:
            avatar_file = validated_data["avatar"]
            if avatar_file:
                # Nome único: evita colisão no storage e cache antigo de CDN ao trocar a foto.
                ext = os.path.splitext(avatar_file.name or "")[1].lower()[:6] or ".jpg"
                avatar_file.name = f"{instance.pk}-{uuid.uuid4().hex[:8]}{ext}"
            # Qualquer upload novo (ou remoção) encerra o uso do base64 legado.
            instance.avatar_base64 = None
        return super().update(instance, validated_data)


# ── Change password ──────────────────────────────────────────────────────────

class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, validators=[validate_password])
    new_password_confirm = serializers.CharField(write_only=True)

    def validate(self, data):
        if data["new_password"] != data["new_password_confirm"]:
            raise serializers.ValidationError({"new_password_confirm": "As senhas não conferem."})
        return data

    def validate_old_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Senha atual incorreta.")
        return value


from .models import UserSurvey

class UserSurveySerializer(serializers.ModelSerializer):
    class Meta:
        model = UserSurvey
        fields = [
            "bio", "date_of_birth", "preferred_category", "education_level", 
            "marital_status", "gender", "preferred_brand", "profession", 
            "primary_intent", "other_interests", "updated_at"
        ]
        read_only_fields = ["updated_at"]


from .models import Notification

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ["id", "title", "message", "type", "related_entity_id", "is_read", "created_at"]
        read_only_fields = ["id", "created_at"]


# ── Addresses ────────────────────────────────────────────────────────────────

from .models import Address

class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Address
        fields = [
            "id", "label", "recipient_name", "cep", "logradouro", "numero",
            "complemento", "bairro", "cidade", "uf", "reference_point",
            "observation", "is_default", "created_at"
        ]
        read_only_fields = ["id", "created_at"]

    def create(self, validated_data):
        user = self.context["request"].user
        # Se for o primeiro, ou for marcado como is_default, desmarcar os outros
        if validated_data.get("is_default") or not Address.objects.filter(user=user).exists():
            Address.objects.filter(user=user).update(is_default=False)
            validated_data["is_default"] = True
            
        validated_data["user"] = user
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if validated_data.get("is_default") and not instance.is_default:
            Address.objects.filter(user=instance.user).update(is_default=False)
        return super().update(instance, validated_data)

