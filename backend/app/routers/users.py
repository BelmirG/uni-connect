import uuid
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy import or_

from app.core.constants import FACULTIES
from app.database import get_db
from app.dependencies import get_current_user
from app.models.club import Club
from app.models.club_member import ClubMember
from app.models.follow import Follow
from app.models.post import Post
from app.models.user import User
from app.routers.posts import _build_post_select, _row_to_response, _user_votes
from app.schemas.post import PostResponse

router = APIRouter(prefix="/api/users", tags=["users"])

FacultyLiteral = Optional[Literal['FMS', 'FENS', 'FASS', 'FBA', 'FLW', 'FEDU']]


class UpdateProfileRequest(BaseModel):
    display_name: str = Field(min_length=1, max_length=100)
    bio: str = Field(default="", max_length=300)
    faculty: FacultyLiteral = None
    program: Optional[str] = Field(default=None, max_length=200)


# ── helpers ───────────────────────────────────────────────────────────────────

async def _get_active_user(username: str, db: AsyncSession) -> User:
    user = (await db.execute(
        select(User).where(User.username == username, User.is_active == True)
    )).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return user


async def _follow_counts(user_id: uuid.UUID, db: AsyncSession) -> tuple[int, int]:
    followers = (await db.execute(
        select(func.count()).where(Follow.following_id == user_id)
    )).scalar() or 0
    following = (await db.execute(
        select(func.count()).where(Follow.follower_id == user_id)
    )).scalar() or 0
    return followers, following


# ── literal paths before /{username} ──────────────────────────────────────────

@router.get("/search")
async def search_users(
    q: str = "",
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Search users by username or display name. Returns up to `limit` results
    with an `is_following` flag so the frontend can show the right button."""
    q = q.strip()
    if not q:
        return []

    pattern = f"%{q}%"
    users = (await db.execute(
        select(User)
        .where(
            User.is_active == True,
            User.is_email_verified == True,
            User.id != current_user.id,
            or_(User.username.ilike(pattern), User.display_name.ilike(pattern)),
        )
        .order_by(User.display_name)
        .limit(limit)
    )).scalars().all()

    if not users:
        return []

    # Batch-check which of these users the current user already follows
    user_ids = [u.id for u in users]
    following_ids = set(
        row[0] for row in (await db.execute(
            select(Follow.following_id).where(
                Follow.follower_id == current_user.id,
                Follow.following_id.in_(user_ids),
            )
        )).all()
    )

    return [
        {
            "username": u.username,
            "display_name": u.display_name,
            "faculty": u.faculty,
            "program": u.program,
            "is_following": u.id in following_ids,
        }
        for u in users
    ]


@router.put("/me")
async def update_profile(
    body: UpdateProfileRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    current_user.display_name = body.display_name.strip()
    current_user.bio = body.bio.strip() or None
    current_user.faculty = body.faculty or None
    current_user.program = body.program.strip() if body.program else None
    await db.commit()
    await db.refresh(current_user)
    return {
        "username": current_user.username,
        "display_name": current_user.display_name,
        "bio": current_user.bio,
        "faculty": current_user.faculty,
        "program": current_user.program,
    }


# ── parameterised routes ───────────────────────────────────────────────────────

@router.get("/{username}")
async def get_profile(
    username: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target = await _get_active_user(username, db)

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

    follower_count, following_count = await _follow_counts(target.id, db)

    is_following = False
    if target.id != current_user.id:
        is_following = bool((await db.execute(
            select(Follow.follower_id).where(
                Follow.follower_id == current_user.id,
                Follow.following_id == target.id,
            )
        )).scalar_one_or_none())

    return {
        "username": target.username,
        "display_name": target.display_name,
        "bio": target.bio,
        "faculty": target.faculty,
        "program": target.program,
        "member_since": target.created_at.isoformat(),
        "post_count": post_count,
        "club_count": club_count,
        "follower_count": follower_count,
        "following_count": following_count,
        "is_following": is_following,
        "is_own_profile": target.id == current_user.id,
    }


@router.get("/{username}/posts")
async def get_user_posts(
    username: str,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[PostResponse]:
    target = await _get_active_user(username, db)

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


@router.get("/{username}/clubs")
async def get_user_clubs(
    username: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target = await _get_active_user(username, db)

    rows = (await db.execute(
        select(Club, ClubMember.role)
        .join(ClubMember, ClubMember.club_id == Club.id)
        .where(ClubMember.user_id == target.id)
        .order_by(ClubMember.joined_at.asc())
    )).all()

    return [
        {
            "id": str(club.id),
            "name": club.name,
            "slug": club.slug,
            "description": club.description,
            "is_private": club.is_private,
            "role": role,
        }
        for club, role in rows
    ]


@router.post("/{username}/follow", status_code=status.HTTP_204_NO_CONTENT)
async def follow_user(
    username: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target = await _get_active_user(username, db)
    if target.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot follow yourself.")

    existing = (await db.execute(
        select(Follow).where(
            Follow.follower_id == current_user.id,
            Follow.following_id == target.id,
        )
    )).scalar_one_or_none()

    if not existing:
        db.add(Follow(follower_id=current_user.id, following_id=target.id))
        await db.commit()


@router.delete("/{username}/follow", status_code=status.HTTP_204_NO_CONTENT)
async def unfollow_user(
    username: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target = await _get_active_user(username, db)

    existing = (await db.execute(
        select(Follow).where(
            Follow.follower_id == current_user.id,
            Follow.following_id == target.id,
        )
    )).scalar_one_or_none()

    if existing:
        await db.delete(existing)
        await db.commit()
