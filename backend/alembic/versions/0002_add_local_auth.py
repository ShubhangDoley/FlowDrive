"""Add local auth fields to users table.

Revision ID: 0002
Revises: 0001
Create Date: 2026-07-19
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Make google_sub nullable (users created by username/password won't have one)
    op.alter_column("users", "google_sub", nullable=True)

    # Add username and password_hash
    op.add_column("users", sa.Column("username", sa.String(64), nullable=True))
    op.add_column("users", sa.Column("password_hash", sa.Text(), nullable=True))

    # Unique constraint and index on username
    op.create_unique_constraint("uq_users_username", "users", ["username"])
    op.create_index("ix_users_username", "users", ["username"])


def downgrade() -> None:
    op.drop_index("ix_users_username", "users")
    op.drop_constraint("uq_users_username", "users", type_="unique")
    op.drop_column("users", "password_hash")
    op.drop_column("users", "username")
    op.alter_column("users", "google_sub", nullable=False)
