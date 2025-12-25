"""add cover letter PDF fields

Revision ID: 0a5ii9jk9012
Revises: 9f4hh8ij8901
Create Date: 2025-12-24

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '0a5ii9jk9012'
down_revision: str | None = '9f4hh8ij8901'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add cover letter file storage columns
    op.add_column('jobs', sa.Column('cover_letter_file_path', sa.String(500), nullable=True))
    op.add_column('jobs', sa.Column('cover_letter_generated_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('jobs', 'cover_letter_generated_at')
    op.drop_column('jobs', 'cover_letter_file_path')

