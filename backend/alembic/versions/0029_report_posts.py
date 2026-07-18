"""Post reports.

reports.reported_post_id — a report can now target a post instead of a user.
reported_user_id becomes nullable: for anonymous posts it stays NULL so the
report never links the post to its author (the anonymous_post_authors
compartment stays sealed even from the reports queue).

Revision ID: 0029
Revises: 0028
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0029"
down_revision = "0028"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "reports",
        sa.Column(
            "reported_post_id",
            UUID(as_uuid=True),
            sa.ForeignKey("posts.id", ondelete="CASCADE"),
            nullable=True,
        ),
    )
    op.alter_column("reports", "reported_user_id", nullable=True)


def downgrade() -> None:
    op.execute("DELETE FROM reports WHERE reported_user_id IS NULL")
    op.alter_column("reports", "reported_user_id", nullable=False)
    op.drop_column("reports", "reported_post_id")
