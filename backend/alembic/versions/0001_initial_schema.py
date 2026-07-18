"""Initial schema — users, oauth_tokens, files tables.

Revision ID: 0001
Revises:
Create Date: 2026-07-18
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# ── Revision identifiers ──────────────────────────────────────────────────────
revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Define enum types with create_type=False so SQLAlchemy does NOT try to
# auto-create them on table creation. We control ENUM lifecycle manually below.
file_provider_type = postgresql.ENUM(
    "google_drive", "cloudflare_r2", name="file_provider", create_type=False
)
file_intent_type = postgresql.ENUM(
    "permanent", "temporary", name="file_intent", create_type=False
)


def upgrade() -> None:
    conn = op.get_bind()

    # ── Create PostgreSQL ENUM types (idempotent via checkfirst) ─────────────
    postgresql.ENUM("google_drive", "cloudflare_r2", name="file_provider").create(
        conn, checkfirst=True
    )
    postgresql.ENUM("permanent", "temporary", name="file_intent").create(
        conn, checkfirst=True
    )

    # ── users ──────────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("google_sub", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("display_name", sa.String(255), nullable=True),
        sa.Column("avatar_url", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("google_sub", name="uq_users_google_sub"),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("ix_users_google_sub", "users", ["google_sub"])
    op.create_index("ix_users_email", "users", ["email"])

    # ── oauth_tokens ───────────────────────────────────────────────────────────
    op.create_table(
        "oauth_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("encrypted_refresh", sa.Text(), nullable=False),
        sa.Column("access_token_expiry", sa.DateTime(timezone=True), nullable=True),
        sa.Column("provider_metadata", postgresql.JSONB(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("user_id", name="uq_oauth_tokens_user_id"),
    )

    # ── files ──────────────────────────────────────────────────────────────────
    op.create_table(
        "files",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "owner_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("filename", sa.String(512), nullable=False),
        sa.Column("mime_type", sa.String(255), nullable=True),
        sa.Column("size_bytes", sa.BigInteger(), nullable=True),
        sa.Column("provider", file_provider_type, nullable=False),
        sa.Column("provider_obj_id", sa.Text(), nullable=False),
        sa.Column("intent", file_intent_type, nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_files_owner_id", "files", ["owner_id"])
    op.create_index("ix_files_expires_at", "files", ["expires_at"])
    op.create_index("ix_files_intent", "files", ["intent"])


def downgrade() -> None:
    op.drop_table("files")
    op.drop_table("oauth_tokens")
    op.drop_table("users")

    conn = op.get_bind()
    postgresql.ENUM(name="file_intent").drop(conn, checkfirst=True)
    postgresql.ENUM(name="file_provider").drop(conn, checkfirst=True)
