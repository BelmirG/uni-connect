"""Add image_urls array to posts

Revision ID: 0006
Revises: 0005
Create Date: 2026-06-28
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0006'
down_revision = '0005'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'posts',
        sa.Column(
            'image_urls',
            postgresql.ARRAY(sa.String()),
            nullable=False,
            server_default='{}',
        ),
    )


def downgrade():
    op.drop_column('posts', 'image_urls')
