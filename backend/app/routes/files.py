"""
File routes — /api/v1/files/*

All endpoints require an authenticated session (via get_current_user).
Large file downloads are streamed to avoid buffering the whole file in memory.
"""

import uuid
import structlog
from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_completed_user
from app.models.file import FileIntent
from app.models.user import User
from app.schemas.file import FileListResponse, FileRead, FileUploadResponse
from app.services import file_service

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/api/v1/files", tags=["files"])


@router.post(
    "",
    response_model=FileUploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a file",
)
def upload_file(
    upload: UploadFile = File(..., description="The file to upload"),
    intent: FileIntent = Form(..., description="'permanent' (Drive) or 'temporary' (R2)"),
    expiry_hours: int | None = Form(
        None, description="Required for temporary uploads: 1, 24, or 168"
    ),
    drive_account_id: uuid.UUID | None = Form(
        None, description="Optional target Drive account ID for permanent uploads"
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_completed_user),
):
    """
    Upload a file.
    - `intent=permanent` → stored in Google Drive (no expiry)
    - `intent=temporary` → stored in Cloudflare R2, expires after `expiry_hours`
    """
    return file_service.upload_file(
        db=db,
        user=current_user,
        upload=upload,
        intent=intent,
        expiry_hours=expiry_hours,
        drive_account_id=drive_account_id,
    )


@router.get(
    "",
    response_model=FileListResponse,
    summary="List files",
)
def list_files(
    intent: FileIntent | None = Query(None, description="Filter by 'permanent' or 'temporary'"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_completed_user),
):
    """Return all files owned by the authenticated user."""
    return file_service.list_files(db=db, user=current_user, intent_filter=intent)


@router.get(
    "/{file_id}/download",
    summary="Download a file",
)
def download_file(
    file_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_completed_user),
):
    """
    Stream the file content.
    Returns 404 if not found, 403 if not the owner, 410 if expired.
    """
    file, stream = file_service.download_file(db=db, user=current_user, file_id=file_id)

    headers = {
        "Content-Disposition": f'attachment; filename="{file.filename}"',
    }
    if file.size_bytes:
        headers["Content-Length"] = str(file.size_bytes)

    return StreamingResponse(
        content=stream,
        media_type=file.mime_type or "application/octet-stream",
        headers=headers,
    )


@router.delete(
    "/{file_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a file",
)
def delete_file(
    file_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_completed_user),
):
    """
    Delete a file from storage and remove its metadata.
    Returns 404 if not found, 403 if not the owner.
    """
    file_service.delete_file(db=db, user=current_user, file_id=file_id)
