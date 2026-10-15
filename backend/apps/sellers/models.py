import uuid
from django.conf import settings
from django.db import models


class SellerStatus(models.TextChoices):
    PENDING = "pending", "Aguardando aprovação"
    APPROVED = "approved", "Aprovado"
    SUSPENDED = "suspended", "Suspenso"
    REJECTED = "rejected", "Rejeitado"


class PersonType(models.TextChoices):
    PF = "PF", "Pessoa Física"
    PJ = "PJ", "Pessoa Jurídica"


class StoreCategory(models.TextChoices):
    ELETRONICOS = "eletronicos", "Eletrônicos"
    MODA = "moda", "Moda (Geral)"
    ROUPAS = "roupas", "Roupas"
    CALCADOS = "calcados", "Calçados"
    BOLSAS = "bolsas", "Bolsas e Acessórios"
    MODA_FIT = "moda_fit", "Moda Fit"
    MODA_ESPORTIVA = "moda_esportiva", "Moda Esportiva"
    CASA = "casa", "Artigos para Casa"
    FERRAMENTAS = "ferramentas", "Ferramentas"
    ALIMENTOS = "alimentos", "Alimentos"
    OUTROS = "outros", "Outros"

class BankAccountType(models.TextChoices):
    CORRENTE = "corrente", "Conta Corrente"
    POUPANCA = "poupanca", "Conta Poupança"

class Seller(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="seller_profile"
    )
    store_name = models.CharField(max_length=150, unique=True)
    slug = models.SlugField(max_length=160, unique=True)
    description = models.TextField(blank=True)
    main_category = models.CharField(max_length=50, choices=StoreCategory.choices, default=StoreCategory.OUTROS)
    logo = models.ImageField(upload_to="sellers/logos/", blank=True, null=True)
    logo_external = models.URLField(max_length=500, blank=True, null=True)
    
    # Storefront customization
    primary_color = models.CharField(max_length=7, default="#E6B53C", help_text="Cor principal da loja (Hexadecimal)")
    video_url = models.URLField(max_length=500, blank=True, null=True, help_text="Link para vídeo de apresentação (YouTube, Vimeo, etc) - legado")
    presentation_video = models.FileField(upload_to="sellers/videos/", blank=True, null=True, help_text="Vídeo de apresentação enviado pelo lojista (até 30 MB)")
    physical_address = models.TextField(blank=True, help_text="Endereço da loja física ou galpão de distribuição")
    business_hours = models.CharField(max_length=255, blank=True, help_text="Horário de funcionamento (ex: Seg a Sex, 08:00 as 18:00)")
    
    banner = models.ImageField(upload_to="sellers/banners/", blank=True, null=True)
    banner_external = models.URLField(max_length=500, blank=True, null=True)
    banner2 = models.ImageField(upload_to="sellers/banners/", blank=True, null=True)
    banner2_external = models.URLField(max_length=500, blank=True, null=True)
    banner3 = models.ImageField(upload_to="sellers/banners/", blank=True, null=True)
    banner3_external = models.URLField(max_length=500, blank=True, null=True)
    
    # Comissão da plataforma (product owner): padrão 12% (0.1200).
    commission_rate = models.DecimalField(max_digits=5, decimal_places=4, default="0.1200")
    
    # Regras de Venda
    max_installments = models.PositiveIntegerField(default=12, help_text="Número máximo de parcelas permitidas para os produtos desta loja.")
    
    # Moderação e Banimento
    strike_count = models.PositiveIntegerField(default=0, help_text="Quantidade de infrações graves (produtos ilícitos).")
    
    status = models.CharField(max_length=20, choices=SellerStatus.choices, default=SellerStatus.PENDING)

    # Identificação fiscal do lojista (KYC / repasse)
    person_type = models.CharField(max_length=2, choices=PersonType.choices, default=PersonType.PF)
    cpf_cnpj = models.CharField(max_length=18, blank=True, help_text="Somente dígitos. CPF (PF) ou CNPJ (PJ).")

    # Logística / Frete (Melhor Envio)
    origin_cep = models.CharField(max_length=9, blank=True, help_text="CEP de origem do Galpão/Loja para cálculo de frete (Ex: 01001000)")

    # Dados Bancários (Para criação do Efí Payee)
    # Identificador de conta Efí para Split Nativo (payee_code) - A Efí exige conta própria para repasse
    efi_payee_code = models.CharField(max_length=100, blank=True, help_text="Identificador de Conta Digital Efí para repasse (Split)")
    # Dados bancários para repasse manual (fallback)
    pix_key = models.CharField(max_length=150, blank=True)
    # Loja da casa: a venda já cai inteira na conta master da plataforma (EFI_PIX_KEY),
    # que é a conta do próprio dono. Sem split e sem Pix Envio — o repasse nasce
    # liquidado. Só o admin liga isto (não entra em nenhum serializer do lojista).
    receives_in_master = models.BooleanField(
        default=False,
        help_text="Loja da casa: recebe direto na conta Efí master (sem split nem repasse).",
    )
    # Vitrine da home: o admin escolhe quem aparece em destaque e em que ordem,
    # sem deploy — funciona com 1 loja hoje e N amanhã.
    featured_rank = models.PositiveSmallIntegerField(
        null=True, blank=True, db_index=True,
        help_text="Destaque na home: 1 = loja principal, 2, 3… Vazio = sem destaque.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "vendedor"
        verbose_name_plural = "vendedores"
        ordering = ["-created_at"]

    def __str__(self):
        return self.store_name

    @property
    def is_approved(self):
        return self.status == SellerStatus.APPROVED

    @property
    def efi_authorized(self):
        # Loja da casa nunca entra em split: repassar da master para a própria
        # master é rejeitado pelo Efí.
        return bool(self.efi_payee_code) and not self.receives_in_master


class ChatRoom(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="customer_chat_rooms"
    )
    seller = models.ForeignKey(
        Seller, on_delete=models.CASCADE, related_name="seller_chat_rooms"
    )
    product = models.ForeignKey(
        "catalog.Product", on_delete=models.SET_NULL, null=True, blank=True, related_name="chat_rooms"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "sala de chat"
        verbose_name_plural = "salas de chat"
        unique_together = [("customer", "seller", "product")]
        ordering = ["-updated_at"]

    def __str__(self):
        return f"Chat: {self.customer.email} <-> {self.seller.store_name}"


class ChatMessage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    room = models.ForeignKey(
        ChatRoom, on_delete=models.CASCADE, related_name="messages"
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE
    )
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "mensagem de chat"
        verbose_name_plural = "mensagens de chat"
        ordering = ["created_at"]

    def __str__(self):
        return f"De: {self.sender.email} em {self.created_at}"


class SellerReview(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sub_order = models.OneToOneField("orders.SubOrder", on_delete=models.CASCADE, related_name="seller_review")
    seller = models.ForeignKey(Seller, on_delete=models.CASCADE, related_name="received_reviews")
    customer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="given_seller_reviews")
    rating = models.DecimalField(max_digits=3, decimal_places=1)
    comment = models.TextField(max_length=1000, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "avaliação do lojista"
        verbose_name_plural = "avaliações dos lojistas"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.rating}★ para {self.seller.store_name} por {self.customer.email}"


class BuyerReview(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sub_order = models.OneToOneField("orders.SubOrder", on_delete=models.CASCADE, related_name="buyer_review")
    seller = models.ForeignKey(Seller, on_delete=models.CASCADE, related_name="given_buyer_reviews")
    customer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="received_reviews")
    rating = models.DecimalField(max_digits=3, decimal_places=1)
    comment = models.TextField(max_length=1000, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "avaliação do comprador"
        verbose_name_plural = "avaliações dos compradores"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.rating}★ para {self.customer.email} por {self.seller.store_name}"

