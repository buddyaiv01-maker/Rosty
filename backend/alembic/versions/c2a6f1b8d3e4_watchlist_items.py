"""watchlist items

Revision ID: c2a6f1b8d3e4
Revises: e86e2b58afbf
Create Date: 2026-09-03 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c2a6f1b8d3e4'
down_revision: Union[str, None] = 'e86e2b58afbf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'watchlist_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('movie_id', sa.Integer(), nullable=True),
        sa.Column('show_id', sa.Integer(), nullable=True),
        sa.Column('added_at', sa.DateTime(), nullable=False),
        sa.CheckConstraint('(movie_id IS NOT NULL AND show_id IS NULL) OR (movie_id IS NULL AND show_id IS NOT NULL)', name='ck_watchlist_exactly_one_parent'),
        sa.ForeignKeyConstraint(['movie_id'], ['movies.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['show_id'], ['tv_shows.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'movie_id', 'show_id', name='uq_watchlist_user_content'),
    )


def downgrade() -> None:
    op.drop_table('watchlist_items')
