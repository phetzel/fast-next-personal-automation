"""drop_items_table

Revision ID: f97536b40747
Revises: email_sources_001
Create Date: 2025-12-30 08:53:08.051010

Removes the legacy Item example/template table that was used for CRUD demonstration.
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'f97536b40747'
down_revision: str | None = 'email_sources_001'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Drop the legacy items table (was example CRUD template code)
    op.drop_index(op.f("items_title_idx"), table_name="items")
    op.drop_table("items")


def downgrade() -> None:
    # Recreate items table if needed
    op.create_table(
        "items",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id", name=op.f("items_pkey")),
    )
    op.create_index(op.f("items_title_idx"), "items", ["title"], unique=False)
