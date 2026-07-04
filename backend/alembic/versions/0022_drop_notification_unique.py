"""Drop the (user, actor, type) unique constraint on notifications.

It was added in 0011 when 'follow' was the only type — one follow notification
per follower made sense, and users.py upserts it in code anyway. With replies
and mentions the constraint is wrong: the second reply from the same person to
the same author violated it and 500'd the request after the reply had already
committed. Repeatable notification types must allow duplicate (user, actor,
type) rows; each event is its own notification.

Revision ID: 0022
Revises: 0021
"""
from alembic import op

revision = "0022"
down_revision = "0021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("uq_notifications_user_actor_type", "notifications", type_="unique")


def downgrade() -> None:
    # Duplicates created while the constraint was gone would block re-adding it —
    # keep only the newest row per (user, actor, type) first.
    op.execute("""
        DELETE FROM notifications a USING notifications b
        WHERE a.user_id = b.user_id
          AND a.actor_id IS NOT DISTINCT FROM b.actor_id
          AND a.type = b.type
          AND a.created_at < b.created_at
    """)
    op.create_unique_constraint(
        "uq_notifications_user_actor_type", "notifications", ["user_id", "actor_id", "type"]
    )
