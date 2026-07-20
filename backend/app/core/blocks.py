"""User blocking — the one place that answers "are these two blocked?".

Blocking is enforced **mutually**: if A blocks B, neither can find, read, or
interact with the other. Only the direction of the row differs (A sees an
"Unblock" button, B is never told anything happened) — every check below is
symmetric, so B can't route around the block by acting first.

Two shapes are used across the routers:

    hidden = await blocked_user_ids(db, me)      # for list/feed filtering
    if await is_blocked_pair(db, me, them): ...  # for single-target actions

Both directions are covered by one query in each case.

## Deliberate exception: the anonymous Q&A board

Anonymous Q&A posts are **never** block-filtered, and that is a privacy
requirement rather than an oversight. Filtering them would make a post
disappear the moment you block someone, so watching what vanishes would
identify the author — exactly the leak `anonymous_post_authors` exists to
prevent. Blocking hides *identified* content (feed, club, and club posts,
profiles, search, DMs); on the anonymous board there is no identity on
display for a block to act on.
"""
import uuid

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.block import Block


async def blocked_user_ids(db: AsyncSession, user_id: uuid.UUID) -> set[uuid.UUID]:
    """Every user id `user_id` must not see: those they blocked *and* those who
    blocked them. Returns a set (often empty — most users block nobody)."""
    rows = (await db.execute(
        select(Block.blocker_id, Block.blocked_id).where(
            or_(Block.blocker_id == user_id, Block.blocked_id == user_id)
        )
    )).all()
    ids = set()
    for blocker_id, blocked_id in rows:
        ids.add(blocked_id if blocker_id == user_id else blocker_id)
    return ids


async def is_blocked_pair(db: AsyncSession, a: uuid.UUID, b: uuid.UUID) -> bool:
    """True if either user has blocked the other. Use before any action that
    targets one specific person (follow, DM, reply, vote, profile read)."""
    if a == b:
        return False
    hit = (await db.execute(
        select(Block.blocker_id).where(
            or_(
                (Block.blocker_id == a) & (Block.blocked_id == b),
                (Block.blocker_id == b) & (Block.blocked_id == a),
            )
        ).limit(1)
    )).scalar_one_or_none()
    return hit is not None


async def block_state(
    db: AsyncSession, viewer_id: uuid.UUID, target_id: uuid.UUID
) -> tuple[bool, bool]:
    """(viewer_blocked_target, target_blocked_viewer) in one query.

    The profile page needs the direction, not just the fact: someone who
    blocked you keeps a viewable profile showing "You blocked this user" with
    an Unblock button, while the person *they* blocked gets a flat 404.
    """
    if viewer_id == target_id:
        return False, False
    rows = (await db.execute(
        select(Block.blocker_id).where(
            or_(
                (Block.blocker_id == viewer_id) & (Block.blocked_id == target_id),
                (Block.blocker_id == target_id) & (Block.blocked_id == viewer_id),
            )
        )
    )).scalars().all()
    return viewer_id in rows, target_id in rows


def visible_author_clause(author_column, hidden_ids: set[uuid.UUID]):
    """WHERE clause hiding posts written by blocked users.

    NULL authors (anonymous posts, and posts whose author deleted their
    account) must survive: a bare NOT IN drops NULL rows because NULL
    comparisons are never true, which would silently empty the anonymous
    board. Callers pass the result to .where() only when hidden_ids is
    non-empty, but this stays correct either way.
    """
    if not hidden_ids:
        return None
    return or_(author_column.is_(None), author_column.notin_(hidden_ids))
