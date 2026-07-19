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


def get_by_username(db: Session, username: str) -> User | None:
    """Fetch a user by username."""
    stmt = select(User).where(User.username == username)
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
    Create-or-update a user matched by google_sub.
    Also handles the case where a password-based user later connects Drive:
    if a user with the same email already exists (no google_sub), we attach
    the google_sub to that existing account.
    Commits and refreshes the object before returning.
    """
    user = get_by_google_sub(db, google_sub)

    if user is None:
        # Check if a password-based user with this email already exists
        user = get_by_email(db, email)

    if user is None:
        user = User(
            google_sub=google_sub,
            email=email,
            display_name=display_name,
            avatar_url=avatar_url,
        )
        db.add(user)
    else:
        user.google_sub = google_sub
        user.email = email
        if display_name:
            user.display_name = display_name
        if avatar_url:
            user.avatar_url = avatar_url
        user.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(user)
    return user


def create_local(
    db: Session,
    *,
    username: str,
    email: str | None = None,
    password_hash: str,
    display_name: str | None = None,
) -> User:
    """Create a new user with username/password credentials."""
    user = User(
        username=username,
        email=email,
        password_hash=password_hash,
        display_name=display_name or username,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
