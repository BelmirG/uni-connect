"""Per-category notification pop-up preferences.

Stores the categories a user has muted (e.g. ["milestones", "clubs"]) as a
JSONB list on users. Muted = the notification is still created and shows in
the bell, but the live toast is pushed with silent=true so it never pops up.
Storing the *muted* list (not the enabled list) means any future notification
category defaults to ON for everyone with no backfill.

Revision ID: 0023
Revises: 0022
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "0023"
down_revision = "0022"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("muted_notifications", JSONB(), nullable=False, server_default=sa.text("'[]'")),
    )


def downgrade() -> None:
    op.drop_column("users", "muted_notifications")
