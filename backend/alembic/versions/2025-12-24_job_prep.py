"""job prep fields

Revision ID: 9f4hh8ij8901
Revises: 8e3gg7hi7890
Create Date: 2025-12-24

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '9f4hh8ij8901'
down_revision: str | None = '8e3gg7hi7890'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add prep materials columns to jobs table
    op.add_column('jobs', sa.Column('cover_letter', sa.Text(), nullable=True))
    op.add_column('jobs', sa.Column('prep_notes', sa.Text(), nullable=True))
    op.add_column('jobs', sa.Column('prepped_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('jobs', 'prepped_at')
    op.drop_column('jobs', 'prep_notes')
    op.drop_column('jobs', 'cover_letter')


