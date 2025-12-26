"""Add area field to conversations

Revision ID: 7d2ff6gh6789
Revises: 6c1ee5fg5678
Create Date: 2025-12-23

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "7d2ff6gh6789"
down_revision: str | None = "6c1ee5fg5678"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add area column to conversations table
    op.add_column(
        "conversations",
        sa.Column("area", sa.String(50), nullable=True),
    )
    # Add index for filtering by area
    op.create_index(
        "ix_conversations_area",
        "conversations",
        ["area"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_conversations_area", table_name="conversations")
    op.drop_column("conversations", "area")
