"""add attachments to chat_messages

Revision ID: 0017
Revises: 0016
Create Date: 2026-06-30
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "0017"
down_revision = "0016"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "chat_messages",
        sa.Column("attachments", JSONB, nullable=False, server_default="[]"),
    )


def downgrade():
    op.drop_column("chat_messages", "attachments")
