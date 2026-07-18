"""
File repository — all DB operations for the File model.

All queries are scoped to the caller's user_id to prevent cross-user data leakage.
The cleanup scheduler uses list_expired() to find files that need to be removed.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app.models.file import File, FileIntent, FileProvider


def create(
    db: Session,
    *,
    owner_id: uuid.UUID,
    filename: str,
    provider: FileProvider,
    provider_obj_id: str,
    intent: FileIntent,
    mime_type: str | None = None,
    size_bytes: int | None = None,
    expires_at: datetime | None = None,
) -> File:
    """
    Persist a new file metadata record after a successful upload.
    The caller must have already uploaded the bytes to the storage provider.
    """
    file = File(
        owner_id=owner_id,
        filename=filename,
        mime_type=mime_type,
        size_bytes=size_bytes,
        provider=provider,
        provider_obj_id=provider_obj_id,
        intent=intent,
        expires_at=expires_at,
    )
    db.add(file)
    db.commit()
    db.refresh(file)
    return file


def list_by_owner(
    db: Session,
    owner_id: uuid.UUID,
    intent_filter: FileIntent | None = None,
) -> list[File]:
    """
    List all files owned by a user.
    Pass intent_filter=FileIntent.permanent or FileIntent.temporary to narrow results.
    Returns newest-first.
    """
    stmt = (
        select(File)
        .where(File.owner_id == owner_id)
        .order_by(File.created_at.desc())
    )
    if intent_filter is not None:
        stmt = stmt.where(File.intent == intent_filter)
    return list(db.execute(stmt).scalars().all())


def get(db: Session, file_id: str | uuid.UUID) -> File | None:
    """Fetch a single file by primary key. Returns None if not found."""
    if isinstance(file_id, str):
        file_id = uuid.UUID(file_id)
    return db.get(File, file_id)


def delete(db: Session, file_id: str | uuid.UUID) -> None:
    """
    Delete a file metadata record from the DB.
    Caller must delete the remote object BEFORE calling this.
    """
    file = get(db, file_id)
    if file:
        db.delete(file)
        db.commit()


def list_expired(db: Session) -> list[File]:
    """
    Return all temporary files whose expiry time has passed.
    Used by the cleanup scheduler every 15 minutes.
    Only cloudflare_r2 files can expire; permanent Drive files are excluded.
    """
    now = datetime.now(timezone.utc)
    stmt = select(File).where(
        and_(
            File.provider == FileProvider.cloudflare_r2,
            File.expires_at <= now,
        )
    )
    return list(db.execute(stmt).scalars().all())
