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


def _build_chat_payload(msg: ChatMessage, author: User) -> dict:
    return {
        "id": str(msg.id),
        "content": msg.content,
        "attachments": msg.attachments or [],
        "author": {
            "username": author.username,
            "display_name": author.display_name,
            "avatar_url": author.avatar_url,
        },
        "created_at": msg.created_at.isoformat(),
    }


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
        select(ChatMessage, User)
        .join(User, ChatMessage.author_id == User.id)
        .where(ChatMessage.club_id == club.id, ChatMessage.is_deleted == False)
        .order_by(ChatMessage.created_at.desc())
        .limit(limit)
    )).all()

    return list(reversed([_build_chat_payload(row[0], row[1]) for row in rows]))


# ── WebSocket: real-time chat ──────────────────────────────────────────────────

@router.websocket("/{slug}/chat/ws")
async def chat_websocket(websocket: WebSocket, slug: str):
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

                try:
                    data = json.loads(text)
                except json.JSONDecodeError:
                    continue

                content = (data.get("content") or "").strip()
                raw_attachments = data.get("attachments") or []
                attachments = [
                    {
                        "url": str(a.get("url", "")),
                        "name": str(a.get("name", ""))[:255],
                        "size": int(a.get("size", 0)),
                        "mime_type": str(a.get("mime_type", "")),
                    }
                    for a in raw_attachments
                    if isinstance(a, dict) and a.get("url")
                ][:5]

                if not content and not attachments:
                    continue

                if content and len(content) > 2000:
                    content = content[:2000]

                chat_msg = ChatMessage(
                    club_id=club.id,
                    author_id=user.id,
                    content=content or None,
                    attachments=attachments,
                )
                db.add(chat_msg)
                await db.commit()
                await db.refresh(chat_msg)

                payload = json.dumps(_build_chat_payload(chat_msg, user))
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
