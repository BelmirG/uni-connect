"""One place that turns 'something happened' into a notification.

Every notification does the same two things:
  1. INSERT a row into `notifications` (so it shows in the bell dropdown later)
  2. PUBLISH a JSON payload to Redis channel `notif:{user_id}` (so an open
     browser tab shows a toast instantly via the notifications WebSocket)

Routers used to hand-roll both steps; this helper keeps the pattern — and its
privacy rules — in one audited spot.

`actor=None` produces a *system* notification: no user id is stored and no
actor fields are pushed. Anonymous-Q&A answers rely on this — the answerer's
identity must never ride along with the question author's notification.
"""
import json
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.redis import redis
from app.core.webpush import send_web_push
from app.models.notification import Notification
from app.models.user import User

# User-facing preference categories. Users toggle these, not raw type strings —
# and because we store what's MUTED, any future category defaults to ON.
NOTIFICATION_CATEGORIES = ("mentions", "replies", "follows", "milestones", "clubs", "qa_answers")


def category_of(notification_type: str) -> str | None:
    """Map an internal type string to its user-facing preference category."""
    if notification_type in ("mention", "chat_mention"):
        return "mentions"
    if notification_type == "reply":
        return "replies"
    if notification_type == "follow":
        return "follows"
    if notification_type.startswith("milestone"):
        return "milestones"
    if notification_type.startswith("club_"):
        return "clubs"
    if notification_type == "qa_answer":
        return "qa_answers"
    return None


async def push_live(db: AsyncSession, user_id: uuid.UUID, payload: dict) -> None:
    """Live delivery of a notification payload: WS toast (Redis) + browser push.

    Every spot that publishes a `notif:{user_id}` payload should go through
    here so both channels always agree. A `silent` payload still reaches open
    tabs (they need it to refresh the bell) but is never browser-pushed.
    """
    await redis.publish(f"notif:{user_id}", json.dumps(payload))
    await send_web_push(db, user_id, payload)


async def is_muted(db: AsyncSession, user_id: uuid.UUID, notification_type: str) -> bool:
    """Has this user muted the category this notification type belongs to?"""
    category = category_of(notification_type)
    if category is None:
        return False
    muted = (await db.execute(
        select(User.muted_notifications).where(User.id == user_id)
    )).scalar_one_or_none()
    return bool(muted) and category in muted


async def notify(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    type: str,
    actor: User | None = None,
    reference_id: uuid.UUID | None = None,
    payload_type: str | None = None,
    extra: dict | None = None,
    commit: bool = True,
) -> None:
    """Persist a notification and push it live.

    payload_type lets the live toast use a simpler type than the stored row
    (e.g. rows store "milestone_10" so duplicates are queryable, while the
    toast just gets type="milestone" with count in `extra`).
    Never notify someone about their own action — callers check that, since
    only they know which ids are 'self' in their context.
    """
    db.add(Notification(
        user_id=user_id,
        actor_id=actor.id if actor else None,
        type=type,
        reference_id=reference_id,
    ))
    if commit:
        await db.commit()

    payload: dict = {"type": payload_type or type}
    if actor:
        payload["actor_username"] = actor.username
        payload["actor_display_name"] = actor.display_name
        payload["actor_avatar_url"] = actor.avatar_url
    if extra:
        payload.update(extra)
    # Two-level muting: a muted category still lands in the bell (the row above),
    # but the live push carries silent=true so the client shows no popup.
    if await is_muted(db, user_id, type):
        payload["silent"] = True
    await push_live(db, user_id, payload)
