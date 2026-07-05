"""Club banner image.

Revision ID: 0025
Revises: 0024
"""
import sqlalchemy as sa
from alembic import op

revision = "0025"
down_revision = "0024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("clubs", sa.Column("banner_url", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("clubs", "banner_url")
