"""
Cron routes — /api/v1/cron/*

Used for triggering scheduled operations (e.g. Vercel Cron Jobs).
"""

import os

import structlog
from fastapi import APIRouter, Header, HTTPException, status
from app.services.cleanup_service import run_cleanup

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/api/v1/cron", tags=["cron"])


@router.api_route("/cleanup", methods=["GET", "POST"], summary="Trigger temp-file cleanup")
def cron_cleanup(authorization: str | None = Header(None)):
    """
    Trigger cleanup of expired temporary files.
    Called by Vercel Cron (or external cron services).
    Verifies `CRON_SECRET` if configured in environment.
    """
    expected_secret = os.getenv("CRON_SECRET")
    if expected_secret:
        if not authorization or authorization != f"Bearer {expected_secret}":
            logger.warning("cron_cleanup_unauthorized")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or missing CRON_SECRET authorization header",
            )

    logger.info("cron_cleanup_triggered")
    run_cleanup()
    return {"status": "ok", "message": "Cleanup executed successfully"}
