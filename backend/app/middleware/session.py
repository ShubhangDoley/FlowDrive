"""
Pure ASGI session middleware — manages signed cookie sessions using itsdangerous.

Replaces Starlette's BaseHTTPMiddleware-based SessionMiddleware to prevent
event loop deadlocks under concurrent requests and threading.
"""

from itsdangerous import URLSafeTimedSerializer


class PureASGISessionMiddleware:
    """
    Pure ASGI middleware for cookie-based session management.
    Compatible with Starlette request.session dictionary interface.
    """

    def __init__(
        self,
        app,
        secret_key: str,
        session_cookie: str = "flowdrive_session",
        max_age: int = 604800,  # 7 days
        same_site: str = "lax",
        https_only: bool = False,
    ):
        self.app = app
        self.secret_key = secret_key
        self.session_cookie = session_cookie
        self.max_age = max_age
        self.same_site = same_site
        self.https_only = https_only
        self.serializer = URLSafeTimedSerializer(secret_key, salt="cookie-session")

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers_dict = dict(scope.get("headers", []))
        cookie_header = headers_dict.get(b"cookie", b"").decode("utf-8")

        session_data = {}
        cookie_val = None
        for cookie in cookie_header.split(";"):
            if "=" in cookie:
                k, v = cookie.strip().split("=", 1)
                if k == self.session_cookie:
                    cookie_val = v
                    break

        if cookie_val:
            try:
                session_data = self.serializer.loads(cookie_val, max_age=self.max_age)
            except Exception:
                session_data = {}

        scope["session"] = session_data

        async def send_with_session(message):
            if message["type"] == "http.response.start":
                if scope.get("session"):
                    try:
                        signed = self.serializer.dumps(scope["session"])
                        cookie_parts = [
                            f"{self.session_cookie}={signed}",
                            "Path=/",
                            f"Max-Age={self.max_age}",
                            "HttpOnly",
                            f"SameSite={self.same_site.capitalize()}",
                        ]
                        if self.https_only:
                            cookie_parts.append("Secure")
                        cookie_str = "; ".join(cookie_parts)
                        headers = list(message.get("headers", []))
                        headers.append((b"set-cookie", cookie_str.encode("utf-8")))
                        message["headers"] = headers
                    except Exception:
                        pass
                elif cookie_val and not scope.get("session"):
                    cookie_str = f"{self.session_cookie}=; Path=/; Max-Age=0; HttpOnly; SameSite={self.same_site.capitalize()}"
                    headers = list(message.get("headers", []))
                    headers.append((b"set-cookie", cookie_str.encode("utf-8")))
                    message["headers"] = headers

            await send(message)

        await self.app(scope, receive, send_with_session)
