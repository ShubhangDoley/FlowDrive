"""Add drive_account_id FK to files table.

Revision ID: 0005
Revises: 0004
Create Date: 2026-07-26
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

# ── Revision identifiers ──────────────────────────────────────────────────────
revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add drive_account_id column to files
    op.add_column(
        "files",
        sa.Column(
            "drive_account_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("drive_accounts.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_files_drive_account_id", "files", ["drive_account_id"])

    # 2. Backfill existing permanent files
    op.execute(
        """
        UPDATE files
        SET drive_account_id = (
            SELECT da.id
            FROM drive_accounts da
            WHERE da.user_id = files.owner_id
            ORDER BY da.is_default DESC, da.created_at ASC
            LIMIT 1
        )
        WHERE intent = 'permanent';
        """
    )


def downgrade() -> None:
    op.drop_index("ix_files_drive_account_id", table_name="files")
    op.drop_column("files", "drive_account_id")
