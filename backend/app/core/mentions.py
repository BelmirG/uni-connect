"""@username mention handling (shared by post and reply endpoints).

Usernames match the registration charset: letters, digits, underscores, 3–50 chars.
We resolve mentions against real accounts server-side so a notification only fires
for a username that actually exists — a typo like `@nobody` is silently ignored.
"""
import re

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.blocks import blocked_user_ids
from app.core.notify import push_live
from app.models.notification import Notification
from app.models.user import User

# Negative lookbehind: don't treat the domain part of an email (name@host) as a mention.
MENTION_RE = re.compile(r"(?<![a-zA-Z0-9_.])@([a-zA-Z0-9_]{3,50})")


def extract_mention_usernames(content: str) -> set[str]:
    """Return the lower-cased usernames mentioned in `content` (deduplicated)."""
    return {m.lower() for m in MENTION_RE.findall(content or "")}


async def notify_post_mentions(content: str, post, actor: User, db: AsyncSession) -> None:
    """Create + push a 'mention' notification for every real user tagged in `content`.

    The author never notifies themselves. Deep-links to the post via reference_id.
    Runs its own commit so callers can invoke it after their main transaction.
    """
    names = extract_mention_usernames(content)
    if not names:
        return

    users = (await db.execute(
        select(User).where(func.lower(User.username).in_(names), User.id != actor.id)
    )).scalars().all()

    # Mentions write their own notification rows rather than going through
    # notify(), so the block check has to be repeated here: typing @someone who
    # blocked you must not reach them.
    hidden = await blocked_user_ids(db, actor.id)
    users = [u for u in users if u.id not in hidden]
    if not users:
        return

    for u in users:
        db.add(Notification(user_id=u.id, actor_id=actor.id, type="mention", reference_id=post.id))
    await db.commit()

    base = {
        "type": "mention",
        "actor_username": actor.username,
        "actor_display_name": actor.display_name,
        "actor_avatar_url": actor.avatar_url,
        "post_id": str(post.id),
    }
    for u in users:
        # Muted category → still saved above (bell), but pushed without a popup.
        payload = {**base, "silent": "mentions" in (u.muted_notifications or [])}
        await push_live(db, u.id, payload)
