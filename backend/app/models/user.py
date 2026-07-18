"""
User model — one row per person who has authenticated via Google OAuth.
The google_sub column is the stable, unique identifier from Google's identity token.
"""

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, Timestamps, UUIDPrimaryKey


class User(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "users"

    google_sub: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
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
