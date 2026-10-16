from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from apps.users.serializers import (
    ChangePasswordSerializer,
    CustomTokenObtainPairSerializer,
    UserRegisterSerializer,
    UserProfileSerializer,
)


class RegisterView(generics.CreateAPIView):
    """POST /api/v1/auth/register/ — cria conta e retorna tokens."""
    serializer_class = UserRegisterSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # Dispara o e-mail de confirmação (não bloqueia o cadastro se o envio falhar).
        from apps.users.emails import send_verification_email
        email_sent = send_verification_email(user)

        # Gera tokens direto no registro (a conta já navega/compra; só não vira loja
        # enquanto o e-mail não for confirmado).
        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "user": UserProfileSerializer(user, context={"request": request}).data,
                "refresh": str(refresh),
                "access": str(refresh.access_token),
                "email_verification_sent": email_sent,
            },
            status=status.HTTP_201_CREATED,
        )


class VerifyEmailView(APIView):
    """POST /api/v1/auth/verify-email/ — confirma o e-mail a partir do token do link."""
    permission_classes = [AllowAny]

    def post(self, request):
        from django.core import signing
        from django.utils import timezone

        from apps.users.emails import verify_token

        token = (request.data.get("token") or "").strip()
        if not token:
            return Response({"detail": "Token ausente."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            uid = verify_token(token)
        except signing.SignatureExpired:
            return Response(
                {"detail": "Este link expirou. Solicite um novo e-mail de confirmação."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except signing.BadSignature:
            return Response({"detail": "Link de confirmação inválido."}, status=status.HTTP_400_BAD_REQUEST)

        from apps.users.serializers import User
        user = User.objects.filter(pk=uid).first()
        if not user:
            return Response({"detail": "Conta não encontrada."}, status=status.HTTP_404_NOT_FOUND)

        if user.email_verified_at:
            return Response({"detail": "E-mail já confirmado. Você já pode abrir sua loja.", "already_verified": True})

        user.email_verified_at = timezone.now()
        user.is_active = True
        user.save(update_fields=["email_verified_at", "is_active"])
        return Response({"detail": "E-mail confirmado com sucesso! Sua conta está liberada."})


class ResendVerificationView(APIView):
    """POST /api/v1/auth/resend-verification/ — reenvia o link para o usuário logado."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from apps.users.emails import send_verification_email

        user = request.user
        if user.email_verified_at:
            return Response({"detail": "Seu e-mail já está confirmado."})

        if send_verification_email(user):
            return Response({"detail": f"Enviamos um novo link de confirmação para {user.email}."})
        return Response(
            {"detail": "Não foi possível enviar o e-mail agora. Tente novamente em instantes."},
            status=status.HTTP_502_BAD_GATEWAY,
        )


class LoginView(TokenObtainPairView):
    """POST /api/v1/auth/login/ — retorna access + refresh + dados do usuário."""
    serializer_class = CustomTokenObtainPairSerializer
    permission_classes = [AllowAny]


class LogoutView(APIView):
    """POST /api/v1/auth/logout/ — invalida o refresh token (blacklist)."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get("refresh")
            if not refresh_token:
                return Response(
                    {"detail": "O campo 'refresh' é obrigatório."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({"detail": "Logout realizado com sucesso."}, status=status.HTTP_200_OK)
        except Exception:
            return Response({"detail": "Token inválido ou já expirado."}, status=status.HTTP_400_BAD_REQUEST)


class ChangePasswordView(APIView):
    """POST /api/v1/auth/change-password/ — altera a senha do usuário autenticado."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save(update_fields=["password"])

        from apps.users.notifications import notify_password_changed
        notify_password_changed(request.user)

        return Response({"detail": "Senha alterada com sucesso."}, status=status.HTTP_200_OK)


from django.conf import settings
from django.contrib.auth import get_user_model
from google.oauth2 import id_token
from google.auth.transport import requests

User = get_user_model()

class GoogleLoginView(APIView):
    """POST /api/v1/auth/google/ — valida token do google e loga/cria usuário."""
    permission_classes = [AllowAny]

    def post(self, request):
        token = request.data.get("token")
        role = request.data.get("role", "customer") # se vier do registro seller, vem "seller"
        
        if not token:
            return Response({"detail": "Token não fornecido."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Valida a assinatura do token com o Google
            idinfo = id_token.verify_oauth2_token(token, requests.Request(), settings.GOOGLE_CLIENT_ID)
            
            email = idinfo["email"]
            first_name = idinfo.get("given_name", "")
            last_name = idinfo.get("family_name", "")
            
            from django.utils import timezone
            
            # Busca ou cria o usuário pelo email
            # Busca ou cria o usuário pelo email
            try:
                user = User.objects.get(email=email)
                created = False
            except User.DoesNotExist:
                user = User.objects.create_user(
                    email=email,
                    first_name=first_name,
                    last_name=last_name,
                    person_type="PF",
                    role=role,
                )
                user.is_active = True
                user.email_verified_at = timezone.now()
                user.save(update_fields=["is_active", "email_verified_at"])
                created = True

            # Se o usuário já existia mas não estava ativo, ativa agora (pois o Google já validou o email)
            if not created and not user.is_active:
                user.is_active = True
                user.email_verified_at = timezone.now()
                user.save(update_fields=["is_active", "email_verified_at"])

            # Se o usuário não tinha nome, atualiza
            if not created and not user.first_name:
                user.first_name = first_name
                user.last_name = last_name
                user.save(update_fields=["first_name", "last_name"])

            # Gera JWT do MySuperStore
            refresh = RefreshToken.for_user(user)
            return Response(
                {
                    "user": UserProfileSerializer(user, context={"request": request}).data,
                    "refresh": str(refresh),
                    "access": str(refresh.access_token),
                    "is_new": created
                },
                status=status.HTTP_200_OK,
            )

        except ValueError as e:
            return Response({"detail": f"Token do Google inválido. ({str(e)})"}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"detail": f"Erro interno: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class PasswordResetRequestView(APIView):
    """
    POST /api/v1/auth/password-reset/ {email}
    Sempre responde 200 com a mesma mensagem (não revela se o e-mail existe).
    """
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = "password_reset"

    def get_throttles(self):
        from rest_framework.throttling import ScopedRateThrottle
        return [ScopedRateThrottle()]

    def post(self, request):
        from apps.users.password_reset import send_password_reset_email

        email = str(request.data.get("email", "")).strip()
        if email:
            user = User.objects.filter(email__iexact=email, is_active=True).first()
            if user:
                send_password_reset_email(user)
        return Response(
            {"detail": "Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha."},
            status=status.HTTP_200_OK,
        )


class PasswordResetConfirmView(APIView):
    """
    POST /api/v1/auth/password-reset/confirm/ {uid, token, new_password}
    Troca a senha e derruba todas as sessões abertas (refresh tokens na blacklist).
    """
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = "password_reset"

    def get_throttles(self):
        from rest_framework.throttling import ScopedRateThrottle
        return [ScopedRateThrottle()]

    def post(self, request):
        from django.contrib.auth.password_validation import validate_password
        from django.contrib.auth.tokens import default_token_generator
        from django.core.exceptions import ValidationError as DjangoValidationError
        from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

        from apps.users.notifications import notify_password_changed
        from apps.users.password_reset import user_from_uid

        invalid = Response(
            {"detail": "Este link expirou ou já foi usado. Peça um novo."}, status=status.HTTP_400_BAD_REQUEST
        )
        user = user_from_uid(str(request.data.get("uid", "")))
        token = str(request.data.get("token", ""))
        if user is None or not default_token_generator.check_token(user, token):
            return invalid

        new_password = str(request.data.get("new_password", ""))
        try:
            validate_password(new_password, user)
        except DjangoValidationError as exc:
            return Response({"new_password": list(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save(update_fields=["password"])
        for outstanding in OutstandingToken.objects.filter(user=user):
            BlacklistedToken.objects.get_or_create(token=outstanding)
        try:
            notify_password_changed(user)
        except Exception:  # noqa: BLE001 — aviso é best-effort
            pass
        return Response({"detail": "Senha alterada com sucesso."}, status=status.HTTP_200_OK)
