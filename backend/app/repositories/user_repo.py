"""
User repository — all DB operations for the User model.

Rules:
  - No business logic here.
  - Every function receives a Session and returns ORM objects.
  - The caller (service layer) is responsible for committing or rolling back.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User


def get_by_id(db: Session, user_id: str | uuid.UUID) -> User | None:
    """Fetch a user by primary key. Returns None if not found."""
    if isinstance(user_id, str):
        user_id = uuid.UUID(user_id)
    return db.get(User, user_id)


def get_by_google_sub(db: Session, google_sub: str) -> User | None:
    """Fetch a user by their Google subject ID (the 'sub' claim from the ID token)."""
    stmt = select(User).where(User.google_sub == google_sub)
    return db.execute(stmt).scalar_one_or_none()


def get_by_email(db: Session, email: str) -> User | None:
    """Fetch a user by email address."""
    stmt = select(User).where(User.email == email)
    return db.execute(stmt).scalar_one_or_none()


def upsert(
    db: Session,
    *,
    google_sub: str,
    email: str,
    display_name: str | None = None,
    avatar_url: str | None = None,
) -> User:
    """
    Create a new User or update an existing one matched by google_sub.
    Always updates display_name and avatar_url to reflect the latest Google profile.
    Commits and refreshes the object before returning.
    """
    user = get_by_google_sub(db, google_sub)

    if user is None:
        user = User(
            google_sub=google_sub,
            email=email,
            display_name=display_name,
            avatar_url=avatar_url,
        )
        db.add(user)
    else:
        # Keep profile info fresh on every login
        user.email = email
        user.display_name = display_name
        user.avatar_url = avatar_url
        user.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(user)
    return user
