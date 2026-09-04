"""interaction events

Revision ID: d4e9a2c7f1b6
Revises: c2a6f1b8d3e4
Create Date: 2026-09-04 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e9a2c7f1b6'
down_revision: Union[str, None] = 'c2a6f1b8d3e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'interaction_events',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('movie_id', sa.Integer(), nullable=True),
        sa.Column('episode_id', sa.Integer(), nullable=True),
        sa.Column('show_id', sa.Integer(), nullable=True),
        sa.Column('event_type', sa.String(length=32), nullable=False),
        sa.Column('position_sec', sa.Integer(), nullable=True),
        sa.Column('duration_sec', sa.Integer(), nullable=True),
        sa.Column('session_id', sa.String(length=64), nullable=True),
        sa.Column('event_metadata', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['episode_id'], ['episodes.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['movie_id'], ['movies.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['show_id'], ['tv_shows.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('interaction_events', schema=None) as batch_op:
        batch_op.create_index('ix_interaction_events_user_id', ['user_id'])
        batch_op.create_index('ix_interaction_events_event_type', ['event_type'])
        batch_op.create_index('ix_interaction_events_session_id', ['session_id'])
        batch_op.create_index('ix_interaction_events_created_at', ['created_at'])


def downgrade() -> None:
    op.drop_table('interaction_events')
