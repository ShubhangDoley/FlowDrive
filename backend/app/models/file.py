"""
File model — tracks every file uploaded through FlowDrive regardless of
which backend storage provider holds the actual bytes.

Providers:
  google_drive  → permanent files in the user's FlowDrive Drive folder
  cloudflare_r2 → temporary/expiring files in the private R2 bucket

Intents:
  permanent  → no expiry, lives in Google Drive
  temporary  → expires after 1h / 24h / 7d, lives in R2
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, Timestamps, UUIDPrimaryKey


class FileProvider(str, enum.Enum):
    google_drive = "google_drive"
    cloudflare_r2 = "cloudflare_r2"


class FileIntent(str, enum.Enum):
    permanent = "permanent"
    temporary = "temporary"


# Dialect-agnostic ENUM types for database compatibility (SQLite & PostgreSQL)
_provider_enum = Enum(FileProvider, name="file_provider", create_type=False)
_intent_enum = Enum(FileIntent, name="file_intent", create_type=False)


class File(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "files"

    owner_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    filename: Mapped[str] = mapped_column(String(512), nullable=False)
    mime_type: Mapped[str | None] = mapped_column(String(255), nullable=True)
    size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    # Which backend holds the bytes
    provider: Mapped[FileProvider] = mapped_column(_provider_enum, nullable=False)
    # Drive file ID (for google_drive) or object key (for cloudflare_r2)
    provider_obj_id: Mapped[str] = mapped_column(Text, nullable=False)

    # Linked drive account (for google_drive files)
    drive_account_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("drive_accounts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Upload intent
    intent: Mapped[FileIntent] = mapped_column(_intent_enum, nullable=False, index=True)
    # NULL for permanent files; set for temporary files
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )

    # Relationships
    owner: Mapped["User"] = relationship("User", back_populates="files")  # noqa: F821
    drive_account: Mapped["DriveAccount | None"] = relationship("DriveAccount", back_populates="files")  # noqa: F821

    def __repr__(self) -> str:
        return f"<File id={self.id} name={self.filename!r} intent={self.intent}>"
