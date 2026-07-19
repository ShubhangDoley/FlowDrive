"""
User model.

A user can be created via:
  a) Google OAuth only (legacy) — google_sub set, no username/password
  b) Username + password — username/password_hash set, google_sub NULL until Drive connected
"""

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, Timestamps, UUIDPrimaryKey


class User(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "users"

    # Google OAuth identity — NULL for password-only users until they connect Drive
    google_sub: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True, index=True)

    # Local auth — NULL for pure-Google users
    username: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True, index=True)
    password_hash: Mapped[str | None] = mapped_column(Text, nullable=True)

    email: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True, index=True)
    display_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    oauth_token: Mapped["OAuthToken"] = relationship(  # noqa: F821
        "OAuthToken", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    files: Mapped[list["File"]] = relationship(  # noqa: F821
        "File", back_populates="owner", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email!r}>"
