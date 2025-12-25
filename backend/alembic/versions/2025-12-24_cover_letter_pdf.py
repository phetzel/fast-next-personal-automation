"""add cover letter PDF fields

Revision ID: 0a5ii9jk9012
Revises: 9f4hh8ij8901
Create Date: 2025-12-24

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0a5ii9jk9012'
down_revision: Union[str, None] = '9f4hh8ij8901'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add cover letter file storage columns
    op.add_column('jobs', sa.Column('cover_letter_file_path', sa.String(500), nullable=True))
    op.add_column('jobs', sa.Column('cover_letter_generated_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('jobs', 'cover_letter_generated_at')
    op.drop_column('jobs', 'cover_letter_file_path')

