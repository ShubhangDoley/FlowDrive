"""
Centralised configuration — all env-var access goes through `get_settings()`.
Never call os.getenv() directly outside this module.
"""

import os
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict



class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── Application ────────────────────────────────────────────────────────────
    app_env: str = "development"
    app_name: str = "FlowDrive API"
    frontend_url: str = "http://localhost:5173"
    database_url: str = "sqlite:///./flowdrive.db"
    session_secret: str = "flowdrive_session_secret_change_in_production_32b"
    token_encryption_key: str = "flowdrive_token_encryption_key_32bytes_sec"
    cookie_secure: bool = False
    sentry_dsn: str = ""

    # ── Google OAuth + Drive ───────────────────────────────────────────────────
    google_client_id: str = ""
    google_client_secret: str = ""
    google_oauth_redirect_uri: str = "http://localhost:8000/api/v1/auth/google/callback"
    google_drive_folder_name: str = "FlowDrive"

    # ── Cloudflare R2 ──────────────────────────────────────────────────────────
    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket_name: str = ""
    r2_endpoint_url: str = ""
    r2_region: str = "auto"

    # ── Uploads & cleanup ─────────────────────────────────────────────────────
    upload_max_bytes: int = 5_368_709_120  # 5 GB
    temp_cleanup_interval_minutes: int = 15

    @property
    def effective_frontend_url(self) -> str:
        url = self.frontend_url or "https://flowdrive-80s.pages.dev"
        url = url.rstrip("/")
        if not url.startswith("http://") and not url.startswith("https://"):
            return f"https://{url}"
        return url

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def google_configured(self) -> bool:
        return bool(self.google_client_id and self.google_client_secret)

    @property
    def effective_google_redirect_uri(self) -> str:
        if self.google_oauth_redirect_uri and "localhost" not in self.google_oauth_redirect_uri:
            return self.google_oauth_redirect_uri

        vercel_url = os.getenv("VERCEL_PROJECT_PRODUCTION_URL") or os.getenv("VERCEL_URL")
        if vercel_url:
            vercel_url = vercel_url.rstrip("/")
            if not vercel_url.startswith("http://") and not vercel_url.startswith("https://"):
                vercel_url = f"https://{vercel_url}"
            return f"{vercel_url}/api/v1/auth/google/callback"

        return self.google_oauth_redirect_uri or "http://localhost:8000/api/v1/auth/google/callback"



    @property
    def r2_configured(self) -> bool:
        return bool(
            self.r2_access_key_id
            and self.r2_secret_access_key
            and self.r2_bucket_name
            and self.r2_endpoint_url
        )


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings singleton (loaded once per process)."""
    return Settings()
