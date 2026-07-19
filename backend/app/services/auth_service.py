"""
Auth service — Google OAuth flow and session management.

Flow:
  1. Frontend hits GET /auth/google/login → this service builds the redirect URL
  2. Google sends user back to GET /auth/google/callback
  3. This service: validates state, exchanges code, upserts user, saves token,
     creates Drive folder, establishes session, redirects to frontend dashboard
"""

import secrets
import structlog
from datetime import datetime, timezone

from google_auth_oauthlib.flow import Flow
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import encrypt_token
from app.models.user import User
from app.repositories import token_repo, user_repo
from app.schemas.auth import UserMe
from app.storage.google_drive import GoogleDriveStorage
from app.storage.base import StorageError

logger = structlog.get_logger(__name__)

GOOGLE_SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/drive.file",
]


def _build_flow() -> Flow:
    """Build a google-auth Flow from our settings."""
    settings = get_settings()
    return Flow.from_client_config(
        client_config={
            "web": {
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [settings.google_oauth_redirect_uri],
            }
        },
        scopes=GOOGLE_SCOPES,
        redirect_uri=settings.google_oauth_redirect_uri,
    )


def get_google_auth_url(session: dict) -> str:
    """
    Generate a Google OAuth redirect URL.
    Stores a CSRF state token and PKCE code_verifier in the session
    for validation in the callback.
    Returns the URL to redirect the user to.
    """
    import secrets as _secrets
    import hashlib, base64

    flow = _build_flow()
    state = _secrets.token_urlsafe(32)
    session["oauth_state"] = state

    # Generate PKCE code_verifier and store it so callback can use it
    code_verifier = _secrets.token_urlsafe(96)  # 128 URL-safe chars
    session["oauth_code_verifier"] = code_verifier

    # Compute code_challenge (S256)
    digest = hashlib.sha256(code_verifier.encode()).digest()
    code_challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()

    auth_url, _ = flow.authorization_url(
        access_type="offline",
        prompt="consent",
        state=state,
        include_granted_scopes="true",
        code_challenge=code_challenge,
        code_challenge_method="S256",
    )
    logger.info("google_auth_url_generated")
    return auth_url


def handle_callback(
    db: Session,
    session: dict,
    code: str,
    state: str,
) -> User:
    """
    Handle the OAuth callback after Google redirects the user back.

    Steps:
      1. Validate the CSRF state
      2. Exchange the authorization code for tokens
      3. Fetch the user's profile from Google
      4. Upsert the User record
      5. Encrypt and store the refresh token
      6. Create (or reuse) the FlowDrive folder in Drive
      7. Return the User for the caller to set in session

    Raises ValueError on invalid state or missing refresh token.
    """
    # 1. CSRF state validation
    stored_state = session.pop("oauth_state", None)
    if not stored_state or stored_state != state:
        raise ValueError("Invalid OAuth state. Possible CSRF attack.")

    # Retrieve stored PKCE verifier (must match what was sent in the auth URL)
    code_verifier = session.pop("oauth_code_verifier", None)

    # 2. Exchange code for tokens
    flow = _build_flow()
    flow.fetch_token(code=code, code_verifier=code_verifier)
    credentials = flow.credentials

    if not credentials.refresh_token:
        raise ValueError(
            "No refresh token returned by Google. "
            "Revoke app access at https://myaccount.google.com/permissions and try again."
        )

    # 3. Fetch user profile via the ID token
    import google.auth.transport.requests
    import google.oauth2.id_token

    request = google.auth.transport.requests.Request()
    id_info = google.oauth2.id_token.verify_oauth2_token(
        credentials.id_token,
        request,
        get_settings().google_client_id,
    )

    google_sub = id_info["sub"]
    email = id_info.get("email", "")
    display_name = id_info.get("name")
    avatar_url = id_info.get("picture")

    # 4. Upsert the user
    user = user_repo.upsert(
        db,
        google_sub=google_sub,
        email=email,
        display_name=display_name,
        avatar_url=avatar_url,
    )
    logger.info("user_upserted", user_id=str(user.id), email=email)

    # 5. Encrypt and save the refresh token
    encrypted_refresh = encrypt_token(credentials.refresh_token)
    expiry = credentials.expiry  # datetime or None
    token_repo.save(
        db,
        user_id=user.id,
        encrypted_refresh=encrypted_refresh,
        access_token_expiry=expiry,
        provider_metadata={"scopes": list(credentials.scopes) if credentials.scopes else []},
    )
    logger.info("oauth_token_saved", user_id=str(user.id))

    # 6. Create (or reuse) the FlowDrive folder in Drive
    try:
        drive = GoogleDriveStorage(credentials.refresh_token)
        settings = get_settings()
        folder_id = drive.get_or_create_folder(settings.google_drive_folder_name)
        logger.info("drive_folder_ready", user_id=str(user.id), folder_id=folder_id)
    except StorageError as exc:
        # Non-fatal: folder creation failing shouldn't block login
        logger.warning("drive_folder_create_failed", user_id=str(user.id), error=str(exc))

    return user


def get_me(db: Session, user: User) -> UserMe:
    """Return a UserMe schema for the authenticated user, including Drive status."""
    token = token_repo.get_by_user(db, user.id)
    return UserMe(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        avatar_url=user.avatar_url,
        has_drive_connected=token is not None,
        created_at=user.created_at,
    )
