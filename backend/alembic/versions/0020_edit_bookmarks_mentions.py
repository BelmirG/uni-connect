"""Add post edit tracking, bookmarks, and mention notification references.

Revision ID: 0020
Revises: 0019
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0020"
down_revision = "0019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Track when a post was last edited (NULL = never edited → no "edited" badge)
    op.add_column("posts", sa.Column("edited_at", sa.DateTime(timezone=True), nullable=True))

    # 2. Let a notification point at the thing it's about (e.g. a mention → its post),
    #    so the UI can deep-link. NULL for notifications that don't reference a row.
    op.add_column("notifications", sa.Column("reference_id", UUID(as_uuid=True), nullable=True))

    # 3. Bookmarks / saved posts. Composite-unique (user, post) so a post can only be
    #    saved once per user; ON DELETE CASCADE cleans up when either side is removed.
    op.create_table(
        "bookmarks",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("post_id", UUID(as_uuid=True), sa.ForeignKey("posts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "post_id", name="uq_bookmark_user_post"),
    )
    op.create_index("ix_bookmarks_user_created", "bookmarks", ["user_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_bookmarks_user_created", table_name="bookmarks")
    op.drop_table("bookmarks")
    op.drop_column("notifications", "reference_id")
    op.drop_column("posts", "edited_at")
