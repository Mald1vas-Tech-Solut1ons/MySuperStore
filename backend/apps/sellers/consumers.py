import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import ChatRoom, ChatMessage
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db.models import Q

User = get_user_model()

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_id = self.scope["url_route"]["kwargs"]["room_id"]
        self.room_group_name = f"chat_{self.room_id}"
        self.user = self.scope["user"]

        if self.user.is_anonymous:
            await self.close()
            return

        # Só entra quem participa da sala (o cliente ou o dono da loja). Saber o id da
        # sala não é autorização: a mesma regra do ChatRoomViewSet.get_queryset na API REST.
        if not await self.user_can_access_room(self.room_id, self.user):
            await self.close(code=4403)
            return

        # Entra no grupo
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        # Sai do grupo
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    # Recebe mensagem do WebSocket
    async def receive(self, text_data):
        data = json.loads(text_data)
        message = data.get("message")

        if message:
            # Salva no BD
            saved_msg = await self.save_message(self.room_id, self.user, message)

            # Envia pro grupo
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "chat_message",
                    "id": str(saved_msg.id),
                    "message": saved_msg.message,
                    "sender_id": str(self.user.id),
                    "sender_name": self.user.first_name or self.user.email,
                    "created_at": saved_msg.created_at.isoformat(),
                }
            )

    # Recebe do grupo da sala
    async def chat_message(self, event):
        await self.send(text_data=json.dumps(event))

    @database_sync_to_async
    def user_can_access_room(self, room_id, user):
        """True só se a sala existe E o usuário é o cliente ou o dono da loja dela."""
        try:
            return ChatRoom.objects.filter(
                Q(id=room_id) & (Q(customer=user) | Q(seller__user=user))
            ).exists()
        except (ValueError, ValidationError):  # id fora do formato UUID na URL
            return False

    @database_sync_to_async
    def save_message(self, room_id, user, message_text):
        room = ChatRoom.objects.get(id=room_id)
        msg = ChatMessage.objects.create(room=room, sender=user, message=message_text)
        room.save(update_fields=["updated_at"])  # Atualiza last activity
        
        # Notificar o outro participante (comprador ou lojista)
        target_user = room.customer if user.id == room.seller.user.id else room.seller.user
        
        from apps.users.models import Notification
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        
        notif = Notification.objects.create(
            user=target_user,
            title=f"Nova mensagem de {user.first_name or user.email}",
            message=message_text[:50] + ("..." if len(message_text) > 50 else ""),
            type="chat",
            related_entity_id=str(room.id)
        )
        
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"user_{target_user.id}_notifications",
            {
                "type": "send_notification",
                "data": {
                    "id": str(notif.id),
                    "title": notif.title,
                    "message": notif.message,
                    "type": notif.type,
                    "related_entity_id": notif.related_entity_id,
                    "is_read": False,
                    "created_at": notif.created_at.isoformat()
                }
            }
        )
        
        return msg
