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
from app.repositories import drive_account_repo, user_repo
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
    redirect_uri = settings.effective_google_redirect_uri
    return Flow.from_client_config(
        client_config={
            "web": {
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [redirect_uri],
            }
        },
        scopes=GOOGLE_SCOPES,
        redirect_uri=redirect_uri,
    )


def _get_state_serializer():
    from itsdangerous import URLSafeSerializer
    settings = get_settings()
    return URLSafeSerializer(settings.session_secret, salt="google-oauth-state")


def get_google_auth_url(session: dict, user_id: str | None = None) -> str:
    """
    Generate a Google OAuth redirect URL with PKCE and a signed CSRF state token.
    The signed state token contains the user_id and code_verifier so cross-domain redirects work
    even if the session cookie is omitted by the browser.
    """
    import secrets as _secrets
    import hashlib, base64

    flow = _build_flow()

    code_verifier = _secrets.token_urlsafe(96)
    digest = hashlib.sha256(code_verifier.encode()).digest()
    code_challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()

    state_data = {
        "user_id": str(user_id) if user_id else None,
        "code_verifier": code_verifier,
        "nonce": _secrets.token_hex(16),
    }
    state_token = _get_state_serializer().dumps(state_data)
    session["oauth_state"] = state_token
    session["oauth_code_verifier"] = code_verifier

    auth_url, _ = flow.authorization_url(
        access_type="offline",
        prompt="consent",
        state=state_token,
        include_granted_scopes="true",
        code_challenge=code_challenge,
        code_challenge_method="S256",
    )
    logger.info("google_auth_url_generated", user_id=user_id)
    return auth_url


def handle_callback(
    db: Session,
    session: dict,
    code: str,
    state: str,
    attach_to_user_id: str | None = None,
) -> User:
    """
    Handle the OAuth callback after Google redirects the user back.
    """
    # 1. CSRF state & PKCE validation — decrypt signed state token or fallback to session
    user_id_from_state = None
    code_verifier = None
    try:
        serializer = _get_state_serializer()
        payload = serializer.loads(state)
        if isinstance(payload, dict):
            user_id_from_state = payload.get("user_id")
            code_verifier = payload.get("code_verifier")
    except Exception:
        stored_state = session.pop("oauth_state", None)
        if not stored_state or stored_state != state:
            raise ValueError("Invalid OAuth state. Possible CSRF attack.")

    if not code_verifier:
        code_verifier = session.pop("oauth_code_verifier", None)

    if not attach_to_user_id:
        attach_to_user_id = user_id_from_state or session.pop("connecting_drive_for", None)

    # 2. Exchange code for tokens (passing code_verifier)
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

    # 4. Find or attach user
    user = None
    if attach_to_user_id:
        user = user_repo.get_by_id(db, attach_to_user_id)
    
    if user is None:
        user = user_repo.upsert(
            db,
            google_sub=google_sub,
            email=email,
            display_name=display_name,
            avatar_url=avatar_url,
        )


    # Update basic profile attributes if missing
    if not user.email and email:
        user.email = email
    if not user.display_name and display_name:
        user.display_name = display_name
    if not user.avatar_url and avatar_url:
        user.avatar_url = avatar_url
    if not user.google_sub:
        user.google_sub = google_sub
    db.commit()
    db.refresh(user)

    # 5. Save or update DriveAccount
    encrypted_refresh = encrypt_token(credentials.refresh_token)
    expiry = credentials.expiry
    metadata = {"scopes": list(credentials.scopes) if credentials.scopes else []}

    existing_account = drive_account_repo.get_by_google_sub(db, user.id, google_sub)
    if existing_account:
        existing_account.encrypted_refresh = encrypted_refresh
        existing_account.access_token_expiry = expiry
        existing_account.provider_metadata = metadata
        existing_account.account_email = email or existing_account.account_email
        existing_account.display_name = display_name or existing_account.display_name
        existing_account.avatar_url = avatar_url or existing_account.avatar_url
        drive_account_repo.update_account(db, existing_account)
        logger.info("drive_account_updated", user_id=str(user.id), email=email)
    else:
        existing_accounts = drive_account_repo.get_all_by_user(db, user.id)
        is_first = len(existing_accounts) == 0
        drive_account_repo.create(
            db,
            user_id=user.id,
            account_email=email or "connected_drive@gmail.com",
            account_google_sub=google_sub,
            encrypted_refresh=encrypted_refresh,
            display_name=display_name,
            avatar_url=avatar_url,
            access_token_expiry=expiry,
            provider_metadata=metadata,
            is_default=is_first,
        )
        logger.info("drive_account_created", user_id=str(user.id), email=email)

    # 6. Create (or reuse) the FlowDrive folder in Drive
    try:
        drive = GoogleDriveStorage(credentials.refresh_token)
        settings = get_settings()
        folder_id = drive.get_or_create_folder(settings.google_drive_folder_name)
        logger.info("drive_folder_ready", user_id=str(user.id), folder_id=folder_id)
    except StorageError as exc:
        logger.warning("drive_folder_create_failed", user_id=str(user.id), error=str(exc))

    return user


def get_me(db: Session, user: User) -> UserMe:
    """Return a UserMe schema for the authenticated user, including Drive status."""
    accounts = drive_account_repo.get_all_by_user(db, user.id)
    return UserMe(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        avatar_url=user.avatar_url,
        username=user.username,
        has_drive_connected=len(accounts) > 0,
        drive_account_count=len(accounts),
        created_at=user.created_at,
    )


def _hash_password(password: str) -> str:
    import bcrypt
    import hashlib
    prehashed = hashlib.sha256((password or "").encode("utf-8")).hexdigest().encode("utf-8")
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(prehashed, salt).decode("utf-8")


def _verify_password(password: str, hashed_password: str) -> bool:
    import bcrypt
    import hashlib
    if not hashed_password:
        return False
    try:
        prehashed = hashlib.sha256((password or "").encode("utf-8")).hexdigest().encode("utf-8")
        return bcrypt.checkpw(prehashed, hashed_password.encode("utf-8"))
    except Exception:
        return False


def register(
    db: Session,
    *,
    username: str,
    password: str,
) -> User:
    if user_repo.get_by_username(db, username):
        raise ValueError(f"Username '{username}' is already taken.")

    password_hash = _hash_password(password)
    user = user_repo.create_local(
        db,
        username=username,
        email=None,
        password_hash=password_hash,
        display_name=username,
    )
    logger.info("user_registered", user_id=str(user.id), username=username)
    return user


def login(
    db: Session,
    *,
    username_or_email: str,
    password: str,
) -> User:
    if "@" in username_or_email:
        user = user_repo.get_by_email(db, username_or_email)
    else:
        user = user_repo.get_by_username(db, username_or_email)

    if not user:
        raise ValueError("User account does not exist. Please sign up first.")
    if not user.password_hash:
        raise ValueError("This account was created via Google. Please log in with Google.")

    if not _verify_password(password, user.password_hash):
        raise ValueError("Incorrect password. Please check your password.")

    logger.info("user_logged_in_local", user_id=str(user.id))
    return user


def get_drive_connect_url(session: dict, user_id: str | None = None) -> str:
    return get_google_auth_url(session, user_id=user_id)
