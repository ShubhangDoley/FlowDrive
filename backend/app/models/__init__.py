"""
Models package — import all ORM models here so that:
  1. Alembic's env.py can import this single module and discover all metadata.
  2. Relationship references (as strings like "User") resolve correctly.
"""

from app.models.base import Base  # noqa: F401 — re-exported for alembic/env.py
from app.models.drive_account import DriveAccount  # noqa: F401
from app.models.file import File, FileIntent, FileProvider  # noqa: F401
from app.models.oauth_token import OAuthToken  # noqa: F401
from app.models.user import User  # noqa: F401

__all__ = [
    "Base",
    "User",
    "OAuthToken",
    "DriveAccount",
    "File",
    "FileProvider",
    "FileIntent",
]
