import asyncio
import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.redis import redis
from app.core.security import decode_access_token
from app.database import AsyncSessionLocal, get_db
from app.dependencies import get_current_user
from app.models.chat_message import ChatMessage
from app.models.club import Club
from app.models.club_member import ClubMember
from app.models.user import User

router = APIRouter(prefix="/api/clubs", tags=["chat"])


# ── REST: load recent message history ─────────────────────────────────────────

@router.get("/{slug}/chat")
async def get_chat_history(
    slug: str,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    club = (await db.execute(select(Club).where(Club.slug == slug))).scalar_one_or_none()
    if not club:
        raise HTTPException(status_code=404, detail="Club not found.")

    membership = (await db.execute(
        select(ClubMember).where(
            ClubMember.club_id == club.id, ClubMember.user_id == current_user.id
        )
    )).scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=403, detail="You must be a member to access club chat.")

    rows = (await db.execute(
        select(ChatMessage, User.username, User.display_name)
        .join(User, ChatMessage.author_id == User.id)
        .where(ChatMessage.club_id == club.id, ChatMessage.is_deleted == False)
        .order_by(ChatMessage.created_at.desc())
        .limit(limit)
    )).all()

    # Reverse so messages are oldest-first in the response
    return list(reversed([
        {
            "id": str(row[0].id),
            "content": row[0].content,
            "author": {"username": row[1], "display_name": row[2]},
            "created_at": row[0].created_at.isoformat(),
        }
        for row in rows
    ]))


# ── WebSocket: real-time chat ──────────────────────────────────────────────────

@router.websocket("/{slug}/chat/ws")
async def chat_websocket(websocket: WebSocket, slug: str):
    """
    Authentication: the browser sends the same httpOnly JWT cookie it uses for
    all HTTP requests — same-origin WebSocket upgrades include cookies automatically.

    Architecture:
      Each connected client runs two concurrent tasks:
        1. redis_to_ws  — listens on the Redis pub/sub channel and forwards
                          every published message to this WebSocket client.
        2. ws_to_redis  — reads messages from this WebSocket client, persists
                          them to PostgreSQL, then publishes to the Redis channel
                          so ALL connected clients (including this one) receive it.

      Using Redis as the broadcast bus means the design scales to multiple
      server processes — every process that has a subscriber on the channel
      receives the message regardless of which process a client is connected to.
    """
    token = websocket.cookies.get("access_token")
    if not token:
        await websocket.close(code=4001, reason="Not authenticated")
        return

    user_id_str = decode_access_token(token)
    if not user_id_str:
        await websocket.close(code=4001, reason="Invalid or expired token")
        return

    async with AsyncSessionLocal() as db:
        user = (await db.execute(
            select(User).where(User.id == uuid.UUID(user_id_str))
        )).scalar_one_or_none()
        if not user or not user.is_active:
            await websocket.close(code=4001, reason="User not found")
            return

        club = (await db.execute(select(Club).where(Club.slug == slug))).scalar_one_or_none()
        if not club:
            await websocket.close(code=4004, reason="Club not found")
            return

        membership = (await db.execute(
            select(ClubMember).where(
                ClubMember.club_id == club.id, ClubMember.user_id == user.id
            )
        )).scalar_one_or_none()
        if not membership:
            await websocket.close(code=4003, reason="Not a member of this club")
            return

        await websocket.accept()

        channel = f"club_chat:{club.id}"
        pubsub = redis.pubsub()
        await pubsub.subscribe(channel)

        async def redis_to_ws():
            async for msg in pubsub.listen():
                if msg["type"] == "message":
                    try:
                        await websocket.send_text(msg["data"])
                    except Exception:
                        return

        async def ws_to_redis():
            while True:
                try:
                    text = await websocket.receive_text()
                except (WebSocketDisconnect, Exception):
                    return

                content = text.strip()
                if not content or len(content) > 2000:
                    continue

                chat_msg = ChatMessage(club_id=club.id, author_id=user.id, content=content)
                db.add(chat_msg)
                await db.commit()
                await db.refresh(chat_msg)

                payload = json.dumps({
                    "id": str(chat_msg.id),
                    "content": chat_msg.content,
                    "author": {
                        "username": user.username,
                        "display_name": user.display_name,
                    },
                    "created_at": chat_msg.created_at.isoformat(),
                })
                await redis.publish(channel, payload)

        redis_task = asyncio.create_task(redis_to_ws())
        ws_task = asyncio.create_task(ws_to_redis())

        try:
            done, pending = await asyncio.wait(
                {redis_task, ws_task},
                return_when=asyncio.FIRST_COMPLETED,
            )
            for task in pending:
                task.cancel()
                try:
                    await task
                except (asyncio.CancelledError, Exception):
                    pass
        finally:
            await pubsub.unsubscribe(channel)
            await pubsub.aclose()
