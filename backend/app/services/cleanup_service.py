"""
Cleanup service — removes expired temporary files from R2 and the database.

Runs every TEMP_CLEANUP_INTERVAL_MINUTES (default: 15) via APScheduler.
Each run is fully idempotent: partial failures are logged but don't abort the run.
"""

import structlog
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.repositories import file_repo
from app.storage.r2 import R2Storage
from app.storage.base import StorageError

logger = structlog.get_logger(__name__)


def run_cleanup() -> None:
    """
    Entry point called by APScheduler.
    Creates its own DB session (the scheduler runs outside the request cycle).
    """
    db: Session = SessionLocal()
    try:
        _do_cleanup(db)
    finally:
        db.close()


def _do_cleanup(db: Session) -> None:
    """Core cleanup logic — separated for testability."""
    expired = file_repo.list_expired(db)
    if not expired:
        logger.info("cleanup_run", expired_count=0)
        return

    logger.info("cleanup_run_started", expired_count=len(expired))

    deleted_count = 0
    failed_count = 0

    try:
        r2 = R2Storage()
    except StorageError as exc:
        logger.error("cleanup_r2_unavailable", error=str(exc))
        return  # Can't clean up without R2

    for file in expired:
        try:
            r2.delete(file.provider_obj_id)
            file_repo.delete(db, file.id)
            deleted_count += 1
            logger.debug("cleanup_file_deleted", file_id=str(file.id), key=file.provider_obj_id)
        except StorageError as exc:
            # Remote delete failed — skip DB delete; will retry next run
            failed_count += 1
            logger.error(
                "cleanup_file_failed",
                file_id=str(file.id),
                error=str(exc),
            )
        except Exception as exc:
            failed_count += 1
            logger.error(
                "cleanup_unexpected_error",
                file_id=str(file.id),
                error=str(exc),
            )

    logger.info(
        "cleanup_run_complete",
        deleted=deleted_count,
        failed=failed_count,
    )
