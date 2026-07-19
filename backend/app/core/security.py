"""
Security utilities — token encryption and the FastAPI session dependency.

Usage:
  - encrypt_token / decrypt_token  →  called by auth_service to store refresh tokens
  - get_current_user               →  FastAPI Depends() on any protected route
"""

from cryptography.fernet import Fernet, InvalidToken
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db


# ── Fernet helpers ─────────────────────────────────────────────────────────────

def _get_fernet() -> Fernet:
    """Build a Fernet instance from the TOKEN_ENCRYPTION_KEY in settings."""
    key = get_settings().token_encryption_key
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_token(plain: str) -> str:
    """Encrypt a plain-text token string; returns a URL-safe base64 ciphertext."""
    return _get_fernet().encrypt(plain.encode()).decode()


def decrypt_token(cipher: str) -> str:
    """
    Decrypt a Fernet ciphertext.
    Raises ValueError if the token is invalid or has been tampered with.
    """
    try:
        return _get_fernet().decrypt(cipher.encode()).decode()
    except InvalidToken as exc:
        raise ValueError("Token is invalid or has been tampered with.") from exc


# ── Session dependency ─────────────────────────────────────────────────────────

async def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    FastAPI dependency — resolves the authenticated User from the session cookie.
    Raises HTTP 401 if the session is missing or the stored user_id is invalid.

    Usage:
        @router.get("/me")
        def me(user: User = Depends(get_current_user)):
            ...
    """
    user_id: str | None = request.session.get("user_id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. Please log in.",
        )

    # Import here to avoid circular imports (security ← repositories ← models)
    from app.repositories.user_repo import get_by_id

    user = get_by_id(db, user_id)
    if user is None:
        # Session exists but user was deleted — clear stale session
        request.session.clear()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found.",
        )

    return user


def require_owner(file, user) -> None:
    """
    Raise HTTP 403 if `user` does not own `file`.
    Call this inside service/route functions before operating on a file.
    """
    if file.owner_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this file.",
        )


async def get_completed_user(
    user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    FastAPI dependency — ensures the user has set up credentials AND connected Google Drive.
    """
    from app.repositories.token_repo import get_by_user
    if not user.username:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Signup incomplete. Please set up a username and password."
        )
    token = get_by_user(db, user.id)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Google Drive is not connected. Please connect it first."
        )
    return user
