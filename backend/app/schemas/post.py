import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class CreatePostRequest(BaseModel):
    content: str = Field(min_length=1, max_length=10_000)


class VoteRequest(BaseModel):
    vote_type: str  # 'up' | 'down'


class AuthorInfo(BaseModel):
    username: str
    display_name: str


class PostResponse(BaseModel):
    id: uuid.UUID
    content: str
    post_type: str
    author: Optional[AuthorInfo]
    upvotes: int
    downvotes: int
    current_user_vote: Optional[str]   # 'up', 'down', or None
    reply_count: int
    share_count: int = 0
    created_at: datetime
    is_deleted: bool
    parent_post_id: Optional[uuid.UUID]


class VoteResponse(BaseModel):
    upvotes: int
    downvotes: int
    current_user_vote: Optional[str]


class PostListResponse(BaseModel):
    posts: list[PostResponse]
    total: int
