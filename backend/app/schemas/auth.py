"""
Auth schemas — request/response models for the /auth/* endpoints.

These are what the API serialises to JSON; they never expose internal model fields
like encrypted tokens, raw Google subjects, or database primary keys as strings.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class UserRead(BaseModel):
    """Basic public user shape returned on most auth responses."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    display_name: str | None
    avatar_url: str | None
    # Computed on serialisation — True when an OAuthToken row exists for this user
    has_drive_connected: bool = False


class UserMe(UserRead):
    """Extended user info returned only on GET /auth/me (includes timestamps)."""

    created_at: datetime
