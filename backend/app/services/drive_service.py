"""
Drive service — handles Google Drive account management, quota fetching, and default switching.
"""

import uuid
import structlog
from pydantic import BaseModel
from googleapiclient.discovery import build
import google.oauth2.credentials
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import decrypt_token
from app.models.user import User
from app.models.drive_account import DriveAccount
from app.repositories import drive_account_repo, file_repo

logger = structlog.get_logger(__name__)


class StorageQuota(BaseModel):
    limit_bytes: int
    used_bytes: int
    usage_pct: int


class DriveAccountRead(BaseModel):
    id: uuid.UUID
    account_email: str
    display_name: str | None = None
    avatar_url: str | None = None
    is_default: bool
    storage: StorageQuota
    file_count: int
    created_at: str


class DriveAccountListResponse(BaseModel):
    accounts: list[DriveAccountRead]


def fetch_drive_quota(account: DriveAccount) -> StorageQuota:
    try:
        refresh_token = decrypt_token(account.encrypted_refresh)
        settings = get_settings()
        creds = google.oauth2.credentials.Credentials(
            token=None,
            refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=settings.google_client_id,
            client_secret=settings.google_client_secret,
        )
        service = build("drive", "v3", credentials=creds)
        about = service.about().get(fields="storageQuota").execute()
        quota = about.get("storageQuota", {})
        limit = int(quota.get("limit", 0))
        used = int(quota.get("usage", 0))
        pct = int((used / limit) * 100) if limit > 0 else 0
        return StorageQuota(limit_bytes=limit, used_bytes=used, usage_pct=pct)
    except Exception as exc:
        logger.error("fetch_quota_failed", account_id=str(account.id), error=str(exc))
        return StorageQuota(limit_bytes=0, used_bytes=0, usage_pct=0)


def list_user_drives(db: Session, user: User) -> DriveAccountListResponse:
    accounts = drive_account_repo.get_all_by_user(db, user.id)
    items = []
    for account in accounts:
        quota = fetch_drive_quota(account)
        file_count = file_repo.count_by_drive_account(db, account.id)
        items.append(
            DriveAccountRead(
                id=account.id,
                account_email=account.account_email,
                display_name=account.display_name,
                avatar_url=account.avatar_url,
                is_default=account.is_default,
                storage=quota,
                file_count=file_count,
                created_at=account.created_at.isoformat() if account.created_at else "",
            )
        )
    return DriveAccountListResponse(accounts=items)
