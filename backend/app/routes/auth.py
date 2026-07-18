"""
Auth routes — /api/v1/auth/*

All endpoints delegate to auth_service for business logic.
The session cookie is managed here (set on login, cleared on logout).
"""

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.auth import UserMe
from app.services import auth_service

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.get("/google/login", summary="Start Google OAuth login")
def google_login(request: Request):
    """
    Redirect the user to Google's OAuth consent screen.
    The CSRF state token is stored in the session before redirecting.
    """
    settings = get_settings()
    if not settings.google_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth is not configured on this server.",
        )

    auth_url = auth_service.get_google_auth_url(request.session)
    return RedirectResponse(url=auth_url)


@router.get("/google/callback", summary="Handle Google OAuth callback")
def google_callback(
    request: Request,
    code: str,
    state: str,
    db: Session = Depends(get_db),
):
    """
    Google redirects here after the user grants permission.
    Validates state, exchanges the code, upserts the user, and sets the session.
    Redirects to the frontend dashboard on success.
    """
    settings = get_settings()

    try:
        user = auth_service.handle_callback(
            db=db,
            session=request.session,
            code=code,
            state=state,
        )
    except ValueError as exc:
        logger.warning("oauth_callback_failed", error=str(exc))
        return RedirectResponse(
            url=f"{settings.frontend_url}/login?error=oauth_failed",
            status_code=status.HTTP_302_FOUND,
        )
    except Exception as exc:
        logger.error("oauth_callback_error", error=str(exc))
        return RedirectResponse(
            url=f"{settings.frontend_url}/login?error=server_error",
            status_code=status.HTTP_302_FOUND,
        )

    # Establish session
    request.session["user_id"] = str(user.id)
    logger.info("user_logged_in", user_id=str(user.id), email=user.email)

    return RedirectResponse(
        url=f"{settings.frontend_url}/dashboard",
        status_code=status.HTTP_302_FOUND,
    )


@router.post("/logout", summary="Log out the current user")
def logout(request: Request):
    """Clear the session cookie."""
    user_id = request.session.get("user_id", "unknown")
    request.session.clear()
    logger.info("user_logged_out", user_id=user_id)
    return {"message": "Logged out successfully."}


@router.get("/me", response_model=UserMe, summary="Get current user info")
def get_me(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the authenticated user's profile and Drive connection status."""
    return auth_service.get_me(db, current_user)
