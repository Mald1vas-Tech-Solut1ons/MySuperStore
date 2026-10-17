"""Ajustes no daphne para rodar com pouca memória (VM Oracle Micro de 1 GB).

1. O daphne herda ``twisted.web.http.Request``, que em todo POST ``multipart/form-data``
   faz o parse do corpo inteiro com ``email.parser`` só para preencher ``request.args`` —
   o daphne nunca usa isso (o Django faz o próprio parse, em streaming). Esse parse
   duplicado lê o corpo para a memória, concatena, decodifica para ``str`` e monta a
   mensagem: ~13x o tamanho do upload (vídeo de 50 MB → ~650 MB, OOM em 16/10/2026).
   O Twisted (>= 24.x) expõe ``parsePOSTFormSubmission`` para desligar esse parse; o
   daphne 4.1 não repassa a opção, então ligamos aqui em cada ``WebRequest``.

2. O daphne entrega o corpo inteiro à fila do app de uma vez (~1x o tamanho em memória)
   e não tem limite de tamanho. Recusamos com 413 pelo Content-Length, antes de receber
   o corpo, tudo acima de ``settings.MAX_REQUEST_BODY_BYTES`` — sem depender do proxy.
"""
import functools

DEFAULT_MAX_REQUEST_BODY_BYTES = 15 * 1024 * 1024


def _max_body_bytes():
    from django.conf import settings

    return getattr(settings, "MAX_REQUEST_BODY_BYTES", DEFAULT_MAX_REQUEST_BODY_BYTES)


class _DiscardContent:
    """Destino do corpo de uma requisição já recusada: não guarda nada."""

    def write(self, data):
        pass

    def read(self, *args):
        return b""

    def seek(self, *args):
        return 0

    def close(self):
        pass


def _reject_too_large(request):
    request._mss_rejected = True
    request.content = _DiscardContent()
    body = b'{"detail": "Arquivo grande demais para envio."}'
    request.channel.transport.write(
        b"HTTP/1.1 413 Payload Too Large\r\n"
        b"Content-Type: application/json\r\n"
        b"Content-Length: " + str(len(body)).encode() + b"\r\n"
        b"Connection: close\r\n\r\n" + body
    )
    request.channel.loseConnection()


def patch_daphne():
    try:
        from daphne.http_protocol import WebRequest
    except ImportError:  # daphne não instalado (ex.: runserver WSGI)
        return
    if getattr(WebRequest, "_mss_patched", False):
        return
    original_init = WebRequest.__init__
    original_got_length = WebRequest.gotLength
    original_handle_chunk = WebRequest.handleContentChunk
    original_request_received = WebRequest.requestReceived

    @functools.wraps(original_init)
    def __init__(self, *args, **kwargs):
        original_init(self, *args, **kwargs)
        self._parsePOSTFormSubmission = False
        self._mss_rejected = False
        self._mss_received = 0

    @functools.wraps(original_got_length)
    def gotLength(self, length):
        if length is not None and length > _max_body_bytes():
            _reject_too_large(self)
            return
        original_got_length(self, length)

    @functools.wraps(original_handle_chunk)
    def handleContentChunk(self, data):
        if self._mss_rejected:
            return
        # Corpo sem Content-Length (chunked): conta enquanto recebe.
        self._mss_received += len(data)
        if self._mss_received > _max_body_bytes():
            _reject_too_large(self)
            return
        original_handle_chunk(self, data)

    @functools.wraps(original_request_received)
    def requestReceived(self, command, path, version):
        if self._mss_rejected:  # já respondemos 413; não chama o app
            return
        original_request_received(self, command, path, version)

    WebRequest.__init__ = __init__
    WebRequest.gotLength = gotLength
    WebRequest.handleContentChunk = handleContentChunk
    WebRequest.requestReceived = requestReceived
    WebRequest._mss_patched = True
