"""
Auth schemas — request/response models for the /auth/* endpoints.

These are what the API serialises to JSON; they never expose internal model fields
like encrypted tokens, raw Google subjects, or database primary keys as strings.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserRead(BaseModel):
    """Basic public user shape returned on most auth responses."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str | None = None
    display_name: str | None = None
    avatar_url: str | None = None
    username: str | None = None
    # Computed on serialisation — True when an OAuthToken row exists for this user
    has_drive_connected: bool = False


class UserMe(UserRead):
    """Extended user info returned only on GET /auth/me (includes timestamps)."""

    created_at: datetime


class RegisterRequest(BaseModel):
    """Body for POST /auth/register."""

    username: str = Field(min_length=3, max_length=64, pattern=r'^[a-zA-Z0-9_]+$')
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    """Body for POST /auth/login."""

    username: str  # can be username OR email
    password: str
