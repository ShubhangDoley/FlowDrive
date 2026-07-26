"""
DriveAccount repository — DB operations for user's connected Google Drive accounts.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models.drive_account import DriveAccount


def get_all_by_user(db: Session, user_id: str | uuid.UUID) -> list[DriveAccount]:
    if isinstance(user_id, str):
        user_id = uuid.UUID(user_id)
    stmt = (
        select(DriveAccount)
        .where(DriveAccount.user_id == user_id)
        .order_by(DriveAccount.is_default.desc(), DriveAccount.created_at.asc())
    )
    return list(db.execute(stmt).scalars().all())


def get_by_id(
    db: Session,
    account_id: str | uuid.UUID,
    user_id: str | uuid.UUID | None = None,
) -> DriveAccount | None:
    if isinstance(account_id, str):
        account_id = uuid.UUID(account_id)
    account = db.get(DriveAccount, account_id)
    if account and user_id:
        if isinstance(user_id, str):
            user_id = uuid.UUID(user_id)
        if account.user_id != user_id:
            return None
    return account


def get_by_google_sub(
    db: Session,
    user_id: str | uuid.UUID,
    google_sub: str,
) -> DriveAccount | None:
    if isinstance(user_id, str):
        user_id = uuid.UUID(user_id)
    stmt = select(DriveAccount).where(
        DriveAccount.user_id == user_id,
        DriveAccount.account_google_sub == google_sub,
    )
    return db.execute(stmt).scalar_one_or_none()


def create(
    db: Session,
    *,
    user_id: uuid.UUID,
    account_email: str,
    account_google_sub: str,
    encrypted_refresh: str,
    display_name: str | None = None,
    avatar_url: str | None = None,
    access_token_expiry: datetime | None = None,
    provider_metadata: dict | None = None,
    is_default: bool = False,
) -> DriveAccount:
    account = DriveAccount(
        user_id=user_id,
        account_email=account_email,
        account_google_sub=account_google_sub,
        display_name=display_name,
        avatar_url=avatar_url,
        encrypted_refresh=encrypted_refresh,
        access_token_expiry=access_token_expiry,
        provider_metadata=provider_metadata,
        is_default=is_default,
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


def update_account(db: Session, account: DriveAccount) -> DriveAccount:
    account.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(account)
    return account


def delete(db: Session, account: DriveAccount) -> None:
    user_id = account.user_id
    was_default = account.is_default
    db.delete(account)
    db.commit()

    if was_default:
        remaining = get_all_by_user(db, user_id)
        if remaining:
            remaining[0].is_default = True
            db.commit()


def set_default(db: Session, user_id: str | uuid.UUID, account_id: str | uuid.UUID) -> None:
    if isinstance(user_id, str):
        user_id = uuid.UUID(user_id)
    if isinstance(account_id, str):
        account_id = uuid.UUID(account_id)

    # Clear all default flags for user
    db.execute(
        update(DriveAccount)
        .where(DriveAccount.user_id == user_id)
        .values(is_default=False)
    )
    # Set specified account to default
    db.execute(
        update(DriveAccount)
        .where(DriveAccount.user_id == user_id, DriveAccount.id == account_id)
        .values(is_default=True)
    )
    db.commit()
