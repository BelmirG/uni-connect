"""User blocking.

blocks — one row per (blocker, blocked). The composite PK makes blocking
idempotent; unblocking deletes the row. Enforcement is mutual: once a row
exists, neither side can find or interact with the other, so the blocked
user is never told a block happened (they just stop seeing the blocker).

The reverse index exists because every list query asks "who is blocked in
either direction", which reads the blocked_id side too.

Revision ID: 0030
Revises: 0029
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0030"
down_revision = "0029"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "blocks",
        sa.Column(
            "blocker_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "blocked_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_blocks_blocked_id", "blocks", ["blocked_id"])


def downgrade() -> None:
    op.drop_index("ix_blocks_blocked_id", table_name="blocks")
    op.drop_table("blocks")
