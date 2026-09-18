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
from app.schemas.auth import LoginRequest, RegisterRequest, UserMe
from app.services import auth_service

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


def _generate_session_token(session_dict: dict) -> str:
    from itsdangerous import URLSafeTimedSerializer
    settings = get_settings()
    serializer = URLSafeTimedSerializer(settings.session_secret, salt="cookie-session")
    return serializer.dumps(session_dict)



# ── Local auth ────────────────────────────────────────────────────────────────

@router.post("/register", response_model=UserMe, status_code=status.HTTP_201_CREATED,
             summary="Register with username + password")
def register(
    body: RegisterRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Create a new account. Sets the session cookie on success."""
    try:
        user = auth_service.register(
            db,
            username=body.username,
            password=body.password,
        )
    except ValueError as exc:
        logger.warning("registration_failed", username=body.username, error=str(exc))
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))

    request.session["user_id"] = str(user.id)
    me = auth_service.get_me(db, user)
    me.session_token = _generate_session_token(dict(request.session))
    return me


@router.post("/login", response_model=UserMe, summary="Login with username + password")
def local_login(
    body: LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Authenticate with username/email + password. Sets the session cookie on success."""
    try:
        user = auth_service.login(
            db,
            username_or_email=body.username,
            password=body.password,
        )
    except ValueError as exc:
        logger.warning("local_login_failed", username=body.username, error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        )

    request.session["user_id"] = str(user.id)
    me = auth_service.get_me(db, user)
    me.session_token = _generate_session_token(dict(request.session))
    return me



# ── Google OAuth ──────────────────────────────────────────────────────────────

@router.get("/google/login", summary="Start Google OAuth login (new accounts)")
def google_login(request: Request):
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Direct Google sign-in is disabled. Please sign up or sign in using a username and password first."
    )


@router.get("/google/connect-url", summary="Get Google OAuth authorization URL")
def google_connect_url(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """
    Returns JSON { "url": "https://accounts.google.com/..." } for authenticated users.
    Ensures credentials cookie is sent via fetch API.
    """
    settings = get_settings()
    if not settings.google_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth is not configured on this server.",
        )
    request.session["connecting_drive_for"] = str(current_user.id)
    auth_url = auth_service.get_drive_connect_url(request.session, user_id=str(current_user.id))
    logger.info("google_connect_url_generated", user_id=str(current_user.id))
    return {"url": auth_url}


@router.get("/google/connect", summary="Connect Google Drive to existing account")
def google_connect(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    For already-logged-in users: start the Google OAuth flow to link Drive.
    Stores the user_id in the session so the callback knows who to attach to.
    """
    settings = get_settings()
    user_id: str | None = request.session.get("user_id")
    if not user_id:
        logger.warning("google_connect_unauthenticated")
        return RedirectResponse(url=f"{settings.effective_frontend_url}/?error=not_authenticated")

    from app.repositories.user_repo import get_by_id
    user = get_by_id(db, user_id)
    if not user:
        request.session.clear()
        return RedirectResponse(url=f"{settings.effective_frontend_url}/?error=not_authenticated")

    if not settings.google_configured:
        logger.warning("google_connect_not_configured")
        return RedirectResponse(url=f"{settings.effective_frontend_url}/?error=google_not_configured")

    # Mark this as a drive-connect flow
    request.session["connecting_drive_for"] = str(user.id)
    auth_url = auth_service.get_drive_connect_url(request.session, user_id=str(user.id))
    logger.info("redirecting_to_google_oauth", user_id=str(user.id))
    return RedirectResponse(url=auth_url)


@router.get("/google/callback", summary="Handle Google OAuth callback")
def google_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: Session = Depends(get_db),
):
    """
    Google redirects here after the user grants permission.
    Handles both fresh login and Drive-connect flows.
    """
    settings = get_settings()
    if error or not code or not state:
        logger.warning("oauth_callback_cancelled_or_missing", error=error)
        return RedirectResponse(
            url=f"{settings.effective_frontend_url}/?error=oauth_failed",
            status_code=status.HTTP_302_FOUND,
        )

    connecting_for = request.session.pop("connecting_drive_for", None)

    try:
        user = auth_service.handle_callback(
            db=db,
            session=request.session,
            code=code,
            state=state,
            attach_to_user_id=connecting_for,
        )
    except ValueError as exc:
        logger.warning("oauth_callback_failed", error=str(exc))
        return RedirectResponse(
            url=f"{settings.effective_frontend_url}/?error=oauth_failed",
            status_code=status.HTTP_302_FOUND,
        )
    except Exception as exc:
        logger.error("oauth_callback_error", error=str(exc), exc_info=True)
        return RedirectResponse(
            url=f"{settings.effective_frontend_url}/?error=server_error",
            status_code=status.HTTP_302_FOUND,
        )

    request.session["user_id"] = str(user.id)
    logger.info("user_logged_in", user_id=str(user.id), email=user.email)
    token = _generate_session_token(dict(request.session))
    return RedirectResponse(
        url=f"{settings.effective_frontend_url}/?session_token={token}",
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
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the authenticated user's profile and Drive connection status."""
    me = auth_service.get_me(db, current_user)
    me.session_token = _generate_session_token(dict(request.session))
    return me

