import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.club_member import ClubMember
from app.models.post import Post
from app.models.user import User
from app.routers.posts import _build_post_select, _row_to_response, _user_votes
from app.schemas.post import PostResponse

router = APIRouter(prefix="/api/users", tags=["users"])


class UpdateProfileRequest(BaseModel):
    display_name: str = Field(min_length=1, max_length=100)
    bio: str = Field(default="", max_length=300)


# ── literal paths before /{username} ──────────────────────────────────────────

@router.put("/me")
async def update_profile(
    body: UpdateProfileRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    current_user.display_name = body.display_name.strip()
    current_user.bio = body.bio.strip() or None
    await db.commit()
    await db.refresh(current_user)
    return {
        "username": current_user.username,
        "display_name": current_user.display_name,
        "bio": current_user.bio,
    }


# ── parameterised routes ───────────────────────────────────────────────────────

@router.get("/{username}")
async def get_profile(
    username: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target = (await db.execute(
        select(User).where(User.username == username, User.is_active == True)
    )).scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")

    post_count = (await db.execute(
        select(func.count(Post.id)).where(
            Post.author_id == target.id,
            Post.post_type == "feed",
            Post.parent_post_id.is_(None),
            Post.is_deleted == False,
        )
    )).scalar() or 0

    club_count = (await db.execute(
        select(func.count(ClubMember.club_id)).where(ClubMember.user_id == target.id)
    )).scalar() or 0

    return {
        "username": target.username,
        "display_name": target.display_name,
        "bio": target.bio,
        "member_since": target.created_at.isoformat(),
        "post_count": post_count,
        "club_count": club_count,
        "is_own_profile": target.id == current_user.id,
    }


@router.get("/{username}/posts")
async def get_user_posts(
    username: str,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[PostResponse]:
    target = (await db.execute(
        select(User).where(User.username == username, User.is_active == True)
    )).scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")

    where = and_(
        Post.author_id == target.id,
        Post.post_type == "feed",
        Post.parent_post_id.is_(None),
        Post.is_deleted == False,
    )
    rows = (await db.execute(
        _build_post_select(where).order_by(Post.created_at.desc()).limit(limit)
    )).all()

    votes = await _user_votes([r[0].id for r in rows], current_user.id, db)
    return [_row_to_response(r, votes.get(r[0].id)) for r in rows]
