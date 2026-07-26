"""
Drive routes — /api/v1/drive/*

Manage connected Google Drive accounts and retrieve storage quota info.
"""

import uuid
import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.repositories import drive_account_repo, file_repo
from app.services import drive_service

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/api/v1/drive", tags=["drive"])


@router.get("/accounts", response_model=drive_service.DriveAccountListResponse, summary="List connected Google Drive accounts")
def list_accounts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return drive_service.list_user_drives(db=db, user=current_user)


@router.delete("/accounts/{account_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Disconnect a Google Drive account")
def disconnect_account(
    account_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = drive_account_repo.get_by_id(db, account_id, current_user.id)
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Drive account not found.")

    file_count = file_repo.count_by_drive_account(db, account.id)
    if file_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot disconnect account: {file_count} file(s) are still linked to this Drive. Delete them first.",
        )

    all_accounts = drive_account_repo.get_all_by_user(db, current_user.id)
    if len(all_accounts) <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot disconnect your only Google Drive account.",
        )

    drive_account_repo.delete(db, account)
    logger.info("drive_account_disconnected", user_id=str(current_user.id), account_id=str(account_id))


@router.patch("/accounts/{account_id}/default", status_code=status.HTTP_204_NO_CONTENT, summary="Set default Google Drive account")
def set_default(
    account_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = drive_account_repo.get_by_id(db, account_id, current_user.id)
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Drive account not found.")

    drive_account_repo.set_default(db, current_user.id, account.id)
    logger.info("drive_account_set_default", user_id=str(current_user.id), account_id=str(account_id))
