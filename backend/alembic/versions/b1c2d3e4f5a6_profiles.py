"""profiles

Adds a `profiles` table and switches playback_progress/watchlist_items/
interaction_events from user_id to profile_id, since watch data is now
scoped per-profile rather than per-account. The DELETEs below wipe existing
rows in those three tables first — safe right now because the current DB
only holds test data (confirmed empty of real watch history at migration
time), and there's no way to backfill a profile_id for rows that predate
profiles existing anyway.

Revision ID: b1c2d3e4f5a6
Revises: a7b8c9d0e1f2
Create Date: 2026-09-03 14:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b1c2d3e4f5a6'
down_revision: Union[str, None] = 'a7b8c9d0e1f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'profiles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=40), nullable=False),
        sa.Column('avatar_key', sa.String(length=32), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_profiles_user_id', 'profiles', ['user_id'])

    op.execute('DELETE FROM playback_progress')
    with op.batch_alter_table('playback_progress') as batch_op:
        batch_op.drop_constraint('uq_progress_user_content', type_='unique')
        batch_op.drop_column('user_id')
        batch_op.add_column(sa.Column('profile_id', sa.Integer(), nullable=False))
        batch_op.create_foreign_key('fk_progress_profile', 'profiles', ['profile_id'], ['id'], ondelete='CASCADE')
        batch_op.create_unique_constraint('uq_progress_profile_content', ['profile_id', 'movie_id', 'episode_id'])

    op.execute('DELETE FROM watchlist_items')
    with op.batch_alter_table('watchlist_items') as batch_op:
        batch_op.drop_constraint('uq_watchlist_user_content', type_='unique')
        batch_op.drop_column('user_id')
        batch_op.add_column(sa.Column('profile_id', sa.Integer(), nullable=False))
        batch_op.create_foreign_key('fk_watchlist_profile', 'profiles', ['profile_id'], ['id'], ondelete='CASCADE')
        batch_op.create_unique_constraint('uq_watchlist_profile_content', ['profile_id', 'movie_id', 'show_id'])

    op.execute('DELETE FROM interaction_events')
    with op.batch_alter_table('interaction_events') as batch_op:
        batch_op.drop_index('ix_interaction_events_user_id')
        batch_op.drop_column('user_id')
        batch_op.add_column(sa.Column('profile_id', sa.Integer(), nullable=False))
        batch_op.create_foreign_key('fk_events_profile', 'profiles', ['profile_id'], ['id'], ondelete='CASCADE')
        batch_op.create_index('ix_interaction_events_profile_id', ['profile_id'])


def downgrade() -> None:
    op.execute('DELETE FROM interaction_events')
    with op.batch_alter_table('interaction_events') as batch_op:
        batch_op.drop_index('ix_interaction_events_profile_id')
        batch_op.drop_constraint('fk_events_profile', type_='foreignkey')
        batch_op.drop_column('profile_id')
        batch_op.add_column(sa.Column('user_id', sa.Integer(), nullable=False))
        batch_op.create_foreign_key(None, 'users', ['user_id'], ['id'], ondelete='CASCADE')
        batch_op.create_index('ix_interaction_events_user_id', ['user_id'])

    op.execute('DELETE FROM watchlist_items')
    with op.batch_alter_table('watchlist_items') as batch_op:
        batch_op.drop_constraint('uq_watchlist_profile_content', type_='unique')
        batch_op.drop_constraint('fk_watchlist_profile', type_='foreignkey')
        batch_op.drop_column('profile_id')
        batch_op.add_column(sa.Column('user_id', sa.Integer(), nullable=False))
        batch_op.create_foreign_key(None, 'users', ['user_id'], ['id'], ondelete='CASCADE')
        batch_op.create_unique_constraint('uq_watchlist_user_content', ['user_id', 'movie_id', 'show_id'])

    op.execute('DELETE FROM playback_progress')
    with op.batch_alter_table('playback_progress') as batch_op:
        batch_op.drop_constraint('uq_progress_profile_content', type_='unique')
        batch_op.drop_constraint('fk_progress_profile', type_='foreignkey')
        batch_op.drop_column('profile_id')
        batch_op.add_column(sa.Column('user_id', sa.Integer(), nullable=False))
        batch_op.create_foreign_key(None, 'users', ['user_id'], ['id'], ondelete='CASCADE')
        batch_op.create_unique_constraint('uq_progress_user_content', ['user_id', 'movie_id', 'episode_id'])

    op.drop_index('ix_profiles_user_id', table_name='profiles')
    op.drop_table('profiles')
