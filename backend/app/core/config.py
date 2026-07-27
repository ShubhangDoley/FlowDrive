"""
Centralised configuration — all env-var access goes through `get_settings()`.
Never call os.getenv() directly outside this module.
"""

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

    # ── Derived helpers ───────────────────────────────────────────────────────
    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def google_configured(self) -> bool:
        return bool(self.google_client_id and self.google_client_secret)

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
