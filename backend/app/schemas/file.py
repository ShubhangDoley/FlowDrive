"""
File schemas — request/response models for the /files/* endpoints.

Consistent envelope shapes mean the frontend always gets the same structure
whether the operation succeeded or failed.
"""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, field_validator

from app.models.file import FileIntent, FileProvider


# ── Response models ────────────────────────────────────────────────────────────

class FileRead(BaseModel):
    """Full file representation returned on upload, list, and download."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    filename: str
    mime_type: str | None
    size_bytes: int | None
    provider: FileProvider
    intent: FileIntent
    drive_account_id: uuid.UUID | None = None
    drive_account_email: str | None = None
    expires_at: datetime | None
    created_at: datetime

    @property
    def is_expired(self) -> bool:
        from datetime import timezone
        if self.expires_at is None:
            return False
        from datetime import datetime
        return self.expires_at < datetime.now(timezone.utc)


class FileUploadResponse(BaseModel):
    """Returned by POST /files on successful upload."""

    message: str = "File uploaded successfully."
    file: FileRead


class FileListResponse(BaseModel):
    """Returned by GET /files."""

    total: int
    files: list[FileRead]


# ── Request models ─────────────────────────────────────────────────────────────

class FileUploadParams(BaseModel):
    """
    Query/form parameters for POST /files.
    intent:       'permanent' → Google Drive, 'temporary' → Cloudflare R2
    expiry_hours: only valid when intent='temporary'; must be 1, 24, or 168 (7 days)
    """

    intent: FileIntent
    expiry_hours: int | None = None
    drive_account_id: uuid.UUID | None = None

    @field_validator("expiry_hours")
    @classmethod
    def validate_expiry(cls, v: int | None, info) -> int | None:
        intent = info.data.get("intent")
        if intent == FileIntent.temporary:
            if v not in (1, 24, 168):
                raise ValueError(
                    "expiry_hours must be 1, 24, or 168 for temporary uploads."
                )
        elif v is not None:
            raise ValueError("expiry_hours is only valid for temporary uploads.")
        return v


# ── Error envelope ─────────────────────────────────────────────────────────────

class ErrorResponse(BaseModel):
    """Standard error shape for all 4xx/5xx responses."""

    error: str
    detail: str | None = None
