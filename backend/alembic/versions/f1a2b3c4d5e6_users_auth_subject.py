"""users auth_subject

Revision ID: f1a2b3c4d5e6
Revises: d4e9a2c7f1b6
Create Date: 2026-09-03 13:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, None] = 'd4e9a2c7f1b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('users') as batch_op:
        batch_op.add_column(sa.Column('auth_subject', sa.String(length=64), nullable=True))
        batch_op.create_index('ix_users_auth_subject', ['auth_subject'], unique=True)


def downgrade() -> None:
    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_index('ix_users_auth_subject')
        batch_op.drop_column('auth_subject')
