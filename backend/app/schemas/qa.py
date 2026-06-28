import uuid
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

FacultyTag = Optional[Literal['FMS', 'FENS', 'FASS', 'FBA', 'FLW', 'FEDU']]


class CreateQAPostRequest(BaseModel):
    content: str = Field(min_length=1, max_length=10_000)
    faculty_tag: FacultyTag = None


class QAPostResponse(BaseModel):
    id: uuid.UUID
    content: str
    faculty_tag: Optional[str] = None
    # Intentionally no `author` field — not hidden, simply absent from the schema.
    # The posts table itself has author_id = NULL for these posts.
    upvotes: int
    downvotes: int
    current_user_vote: Optional[str]
    reply_count: int
    created_at: datetime
    is_deleted: bool
    parent_post_id: Optional[uuid.UUID]


class QAListResponse(BaseModel):
    posts: list[QAPostResponse]
    total: int
