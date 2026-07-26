"""Create drive_accounts table and migrate oauth_tokens data.

Revision ID: 0004
Revises: 0003
Create Date: 2026-07-26
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

# ── Revision identifiers ──────────────────────────────────────────────────────
revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create drive_accounts table
    op.create_table(
        "drive_accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("account_email", sa.String(255), nullable=False),
        sa.Column("account_google_sub", sa.String(255), nullable=False),
        sa.Column("display_name", sa.String(255), nullable=True),
        sa.Column("avatar_url", sa.Text(), nullable=True),
        sa.Column("encrypted_refresh", sa.Text(), nullable=False),
        sa.Column("access_token_expiry", sa.DateTime(timezone=True), nullable=True),
        sa.Column("provider_metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("is_default", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "account_google_sub", name="uq_drive_accounts_user_sub"),
    )

    # 2. Migrate existing data from oauth_tokens into drive_accounts
    op.execute(
        """
        INSERT INTO drive_accounts (
            id, user_id, account_email, account_google_sub, display_name, avatar_url,
            encrypted_refresh, access_token_expiry, provider_metadata, is_default, created_at, updated_at
        )
        SELECT
            gen_random_uuid(),
            ot.user_id,
            COALESCE(u.email, u.username, 'connected_account@gmail.com'),
            COALESCE(u.google_sub, 'legacy_' || ot.user_id::text),
            u.display_name,
            u.avatar_url,
            ot.encrypted_refresh,
            ot.access_token_expiry,
            ot.provider_metadata,
            true,
            ot.created_at,
            ot.updated_at
        FROM oauth_tokens ot
        JOIN users u ON ot.user_id = u.id;
        """
    )

    # 3. Drop unique constraint on oauth_tokens user_id
    op.execute("ALTER TABLE oauth_tokens DROP CONSTRAINT IF EXISTS uq_oauth_tokens_user_id;")


def downgrade() -> None:
    op.create_unique_constraint("uq_oauth_tokens_user_id", "oauth_tokens", ["user_id"])
    op.drop_table("drive_accounts")
