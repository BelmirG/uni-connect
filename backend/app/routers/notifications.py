import asyncio
import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.core.redis import redis
from app.core.security import decode_access_token
from app.database import get_db
from app.dependencies import get_current_user
from app.models.club import Club
from app.models.notification import Notification
from app.models.post import Post
from app.models.user import User

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("")
async def get_notifications(
    limit: int = 30,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from sqlalchemy import func
    Actor = aliased(User)
    # reference_id can point at a post ("mention", "reply", …) or a club
    # ("chat_mention", "club_*"); resolve both so the UI can deep-link without
    # extra requests. The actor join is OUTER because system notifications
    # (milestones, anonymous Q&A answers) deliberately have no actor.
    base = (
        select(Notification, Actor, Post.post_type, Club.slug, Club.name)
        .outerjoin(Actor, Actor.id == Notification.actor_id)
        .outerjoin(Post, Post.id == Notification.reference_id)
        .outerjoin(Club, Club.id == Notification.reference_id)
        .where(Notification.user_id == current_user.id)
    )
    total = (await db.execute(
        select(func.count()).select_from(Notification).where(Notification.user_id == current_user.id)
    )).scalar_one()
    rows = (await db.execute(
        base.order_by(Notification.created_at.desc()).limit(limit).offset(offset)
    )).all()
    return {
        "total": total,
        "notifications": [
            {
                "id": str(n.id),
                "type": n.type,
                "reference_id": str(n.reference_id) if n.reference_id else None,
                "reference_post_type": post_type,
                "reference_club_slug": club_slug,
                "reference_club_name": club_name,
                "is_read": n.is_read,
                "created_at": n.created_at.isoformat(),
                "actor_username": actor.username if actor else None,
                "actor_display_name": actor.display_name if actor else None,
                "actor_avatar_url": actor.avatar_url if actor else None,
            }
            for n, actor, post_type, club_slug, club_name in rows
        ],
    }


@router.post("/mark-read")
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await db.execute(
        update(Notification)
        .where(Notification.user_id == current_user.id, Notification.is_read == False)
        .values(is_read=True)
    )
    await db.commit()
    return {"ok": True}


@router.websocket("/ws")
async def notifications_ws(websocket: WebSocket):
    """
    WebSocket endpoint for real-time push notifications.
    Auth via JWT cookie (same as the DM WebSocket).
    """
    token = websocket.cookies.get("access_token")
    if not token:
        await websocket.close(code=4001, reason="Not authenticated")
        return
    user_id_str = decode_access_token(token)
    if not user_id_str:
        await websocket.close(code=4001, reason="Invalid token")
        return

    user_id = uuid.UUID(user_id_str)
    await websocket.accept()

    channel = f"notif:{user_id}"
    pubsub = redis.pubsub()
    await pubsub.subscribe(channel)

    try:
        async for msg in pubsub.listen():
            if msg["type"] == "message":
                try:
                    await websocket.send_text(msg["data"])
                except (WebSocketDisconnect, Exception):
                    break
    except (WebSocketDisconnect, asyncio.CancelledError, Exception):
        pass
    finally:
        await pubsub.unsubscribe(channel)
        await pubsub.aclose()
