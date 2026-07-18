"""
Request ID middleware — stamps every request with a unique X-Request-ID header
and binds it to the structlog context so it appears in every log line.
"""

import uuid

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class RequestIDMiddleware(BaseHTTPMiddleware):
    """
    Injects a unique request ID into:
      - The structlog context (available in all log calls during this request)
      - The response headers (so clients/proxies can correlate logs)
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        # Accept an incoming request ID from a proxy, or generate a fresh one
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())

        # Bind to structlog context for this request's lifetime
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=request_id)

        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response
