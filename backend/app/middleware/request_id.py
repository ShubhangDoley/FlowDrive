"""
Request ID middleware — stamps every request with a unique X-Request-ID header
and binds it to the structlog context so it appears in every log line.

Implemented as pure ASGI middleware to avoid BaseHTTPMiddleware event loop deadlocks.
"""

import uuid
import structlog


class RequestIDMiddleware:
    """
    Injects a unique request ID into:
      - The structlog context (available in all log calls during this request)
      - The response headers (so clients/proxies can correlate logs)
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers_dict = dict(scope.get("headers", []))
        incoming_id = headers_dict.get(b"x-request-id", b"").decode("utf-8")
        request_id = incoming_id or str(uuid.uuid4())

        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=request_id)

        async def send_with_header(message):
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                headers.append((b"x-request-id", request_id.encode("utf-8")))
                message["headers"] = headers
            await send(message)

        await self.app(scope, receive, send_with_header)
