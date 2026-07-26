"""
DriveAccount model — stores Google OAuth tokens and account metadata per connected Drive.
Each user can have multiple connected Google Drive accounts.
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, Timestamps, UUIDPrimaryKey


class DriveAccount(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "drive_accounts"
    __table_args__ = (
        UniqueConstraint("user_id", "account_google_sub", name="uq_drive_accounts_user_sub"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    account_email: Mapped[str] = mapped_column(String(255), nullable=False)
    account_google_sub: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    encrypted_refresh: Mapped[str] = mapped_column(Text, nullable=False)
    access_token_expiry: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    provider_metadata: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="drive_accounts")  # noqa: F821
    files: Mapped[list["File"]] = relationship("File", back_populates="drive_account")  # noqa: F821

    def __repr__(self) -> str:
        return f"<DriveAccount id={self.id} email={self.account_email!r} default={self.is_default}>"
