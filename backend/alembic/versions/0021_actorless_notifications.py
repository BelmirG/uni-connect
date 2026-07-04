"""Allow notifications without an actor.

Upvote milestones ("your post reached 10 upvotes") have no single actor, and
anonymous-Q&A answer notifications must not record one — storing the answerer's
id next to the question author's notification would quietly rebuild the
author↔post link that anonymous_post_authors exists to compartmentalize.

Revision ID: 0021
Revises: 0020
"""
from alembic import op
import sqlalchemy as sa

revision = "0021"
down_revision = "0020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("notifications", "actor_id", nullable=True)


def downgrade() -> None:
    # Actorless rows can't survive a NOT NULL constraint — drop them first.
    op.execute("DELETE FROM notifications WHERE actor_id IS NULL")
    op.alter_column("notifications", "actor_id", nullable=False)
