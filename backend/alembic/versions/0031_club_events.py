"""Club events.

Events ride on the existing posts row rather than getting a table of their
own — same approach polls take. An event is a club post that additionally
carries a start time, an optional end time, and an optional location, so it
keeps every behaviour posts already have (replies, votes, pinning, editing,
moderation, soft delete) for free.

event_rsvps mirrors poll_votes: one row per (post, user), the composite PK
making "going" idempotent and the status column letting a member switch
between going and interested without a second row.

Revision ID: 0031
Revises: 0030
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0031"
down_revision = "0030"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("posts", sa.Column("event_starts_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("posts", sa.Column("event_ends_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("posts", sa.Column("event_location", sa.String(200), nullable=True))

    op.create_table(
        "event_rsvps",
        sa.Column(
            "post_id",
            UUID(as_uuid=True),
            sa.ForeignKey("posts.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("status", sa.String(10), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    # "What's coming up in this club" sorts by start time over club posts.
    op.create_index(
        "ix_posts_event_starts_at",
        "posts",
        ["club_id", "event_starts_at"],
        postgresql_where=sa.text("event_starts_at IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_posts_event_starts_at", table_name="posts")
    op.drop_table("event_rsvps")
    op.drop_column("posts", "event_location")
    op.drop_column("posts", "event_ends_at")
    op.drop_column("posts", "event_starts_at")
