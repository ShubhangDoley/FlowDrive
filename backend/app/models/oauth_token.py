"""
OAuthToken model — stores the encrypted Google refresh token for each user.
One token row per user (enforced by the unique constraint on user_id).
The refresh token itself is never stored in plain text — always encrypted
via Fernet (see app/core/security.py).
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, Timestamps, UUIDPrimaryKey


class OAuthToken(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "oauth_tokens"
    __table_args__ = (UniqueConstraint("user_id", name="uq_oauth_tokens_user_id"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    # Fernet-encrypted refresh token — decrypt before use
    encrypted_refresh: Mapped[str] = mapped_column(Text, nullable=False)
    # Optional: cache the access-token expiry so we only re-fetch when needed
    access_token_expiry: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Provider metadata (scopes granted, token type, etc.) — stored as JSONB
    provider_metadata: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="oauth_token")  # noqa: F821

    def __repr__(self) -> str:
        return f"<OAuthToken user_id={self.user_id}>"
