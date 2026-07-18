"""
OAuthToken repository — encrypted refresh token storage per user.

Each user has at most one OAuthToken row (enforced by DB unique constraint).
Call save() to create-or-replace the token on login.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.oauth_token import OAuthToken


def get_by_user(db: Session, user_id: str | uuid.UUID) -> OAuthToken | None:
    """Return the OAuthToken for a user, or None if no token is stored."""
    if isinstance(user_id, str):
        user_id = uuid.UUID(user_id)
    stmt = select(OAuthToken).where(OAuthToken.user_id == user_id)
    return db.execute(stmt).scalar_one_or_none()


def save(
    db: Session,
    *,
    user_id: uuid.UUID,
    encrypted_refresh: str,
    access_token_expiry: datetime | None = None,
    provider_metadata: dict | None = None,
) -> OAuthToken:
    """
    Create-or-replace the OAuth token for a user.
    Because the DB enforces one token per user, we delete the existing row
    first if it exists, then insert the new one.
    Commits and refreshes before returning.
    """
    existing = get_by_user(db, user_id)
    if existing:
        existing.encrypted_refresh = encrypted_refresh
        existing.access_token_expiry = access_token_expiry
        existing.provider_metadata = provider_metadata
        existing.updated_at = datetime.now(timezone.utc)
        token = existing
    else:
        token = OAuthToken(
            user_id=user_id,
            encrypted_refresh=encrypted_refresh,
            access_token_expiry=access_token_expiry,
            provider_metadata=provider_metadata,
        )
        db.add(token)

    db.commit()
    db.refresh(token)
    return token


def delete(db: Session, user_id: str | uuid.UUID) -> None:
    """Remove the stored OAuth token for a user (e.g. on logout or revocation)."""
    token = get_by_user(db, user_id)
    if token:
        db.delete(token)
        db.commit()
