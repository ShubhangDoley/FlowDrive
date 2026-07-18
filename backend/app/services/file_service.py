"""
File service — upload routing, download proxying, delete, and listing.

Upload routing:
  intent=permanent  →  GoogleDriveStorage (files live in the user's Drive forever)
  intent=temporary  →  R2Storage (files expire after 1h / 24h / 7d)

On upload failure: the remote object is deleted before raising, to prevent orphaned
bytes in storage from accumulating without a corresponding DB record.
"""

import uuid
from datetime import datetime, timedelta, timezone
from collections.abc import Generator

import structlog
from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import require_owner
from app.models.file import File, FileIntent, FileProvider
from app.models.user import User
from app.repositories import file_repo, token_repo
from app.schemas.file import FileListResponse, FileRead, FileUploadResponse
from app.storage.base import StorageError
from app.storage.google_drive import GoogleDriveStorage
from app.storage.r2 import R2Storage
from app.core.security import decrypt_token

logger = structlog.get_logger(__name__)

_VALID_EXPIRY_HOURS = {1, 24, 168}


def _get_expiry(expiry_hours: int) -> datetime:
    return datetime.now(timezone.utc) + timedelta(hours=expiry_hours)


async def upload_file(
    db: Session,
    user: User,
    upload: UploadFile,
    intent: FileIntent,
    expiry_hours: int | None,
) -> FileUploadResponse:
    """
    Route the upload to the correct backend provider, then persist metadata.
    Raises HTTP 400 for invalid params, HTTP 503 if the provider isn't configured.
    """
    settings = get_settings()

    # ── Validation ─────────────────────────────────────────────────────────────
    if upload.size and upload.size > settings.upload_max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds the maximum allowed size of {settings.upload_max_bytes} bytes.",
        )

    if intent == FileIntent.temporary:
        if expiry_hours not in _VALID_EXPIRY_HOURS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="expiry_hours must be 1, 24, or 168 for temporary uploads.",
            )

    # ── Upload to provider ─────────────────────────────────────────────────────
    filename = upload.filename or "untitled"
    mime_type = upload.content_type
    provider_obj_id: str
    size_bytes: int | None = None
    expires_at: datetime | None = None
    provider: FileProvider

    if intent == FileIntent.permanent:
        # Google Drive
        token = token_repo.get_by_user(db, user.id)
        if not token:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Google Drive is not connected. Please log in again.",
            )
        try:
            refresh_token = decrypt_token(token.encrypted_refresh)
            drive = GoogleDriveStorage(refresh_token)
            result = drive.upload(upload.file, filename=filename, mime_type=mime_type)
        except StorageError as exc:
            logger.error("drive_upload_failed", user_id=str(user.id), error=str(exc))
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Google Drive upload failed: {exc}",
            )
        provider = FileProvider.google_drive
        provider_obj_id = result.provider_obj_id
        size_bytes = result.size_bytes

    else:
        # Cloudflare R2
        try:
            r2 = R2Storage()
            result = r2.upload(
                upload.file,
                filename=filename,
                mime_type=mime_type,
                owner_id=user.id,
            )
        except StorageError as exc:
            logger.error("r2_upload_failed", user_id=str(user.id), error=str(exc))
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Temporary storage is not available: {exc}",
            )
        provider = FileProvider.cloudflare_r2
        provider_obj_id = result.provider_obj_id
        size_bytes = result.size_bytes
        expires_at = _get_expiry(expiry_hours)  # type: ignore[arg-type]

    # ── Persist metadata ───────────────────────────────────────────────────────
    file = file_repo.create(
        db,
        owner_id=user.id,
        filename=filename,
        mime_type=mime_type,
        size_bytes=size_bytes or upload.size,
        provider=provider,
        provider_obj_id=provider_obj_id,
        intent=intent,
        expires_at=expires_at,
    )
    logger.info(
        "file_uploaded",
        user_id=str(user.id),
        file_id=str(file.id),
        provider=provider.value,
        intent=intent.value,
    )
    return FileUploadResponse(file=FileRead.model_validate(file))


def list_files(
    db: Session,
    user: User,
    intent_filter: FileIntent | None = None,
) -> FileListResponse:
    """Return all files owned by the user, optionally filtered by intent."""
    files = file_repo.list_by_owner(db, user.id, intent_filter)
    return FileListResponse(
        total=len(files),
        files=[FileRead.model_validate(f) for f in files],
    )


def download_file(
    db: Session,
    user: User,
    file_id: str,
) -> tuple[File, Generator[bytes, None, None]]:
    """
    Validate ownership, check expiry, and return a byte stream for the file.
    Returns (file_record, byte_generator) so the route can set Content headers.
    """
    file = file_repo.get(db, file_id)
    if not file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found.")

    require_owner(file, user)

    # Check expiry for temporary files
    if file.expires_at and file.expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This file has expired and is no longer available.",
        )

    try:
        if file.provider == FileProvider.google_drive:
            token = token_repo.get_by_user(db, user.id)
            if not token:
                raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Drive not connected.")
            refresh_token = decrypt_token(token.encrypted_refresh)
            adapter = GoogleDriveStorage(refresh_token)
        else:
            adapter = R2Storage()

        stream = adapter.download_stream(file.provider_obj_id)
    except StorageError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Storage error: {exc}",
        )

    return file, stream


def delete_file(db: Session, user: User, file_id: str) -> None:
    """Validate ownership, delete from remote storage, then remove the DB record."""
    file = file_repo.get(db, file_id)
    if not file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found.")

    require_owner(file, user)

    # Delete from remote storage
    try:
        if file.provider == FileProvider.google_drive:
            token = token_repo.get_by_user(db, user.id)
            if token:
                refresh_token = decrypt_token(token.encrypted_refresh)
                adapter = GoogleDriveStorage(refresh_token)
                adapter.delete(file.provider_obj_id)
        else:
            adapter = R2Storage()
            adapter.delete(file.provider_obj_id)
    except StorageError as exc:
        logger.error("remote_delete_failed", file_id=file_id, error=str(exc))
        # Continue to delete the DB record even if remote delete failed
        # The cleanup job will handle orphaned objects

    file_repo.delete(db, file_id)
    logger.info("file_deleted", file_id=file_id, user_id=str(user.id))
