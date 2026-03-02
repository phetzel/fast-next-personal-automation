"""Add finance_categories table for user-managed transaction categories.

Revision ID: finance_categories_001
Revises: finances_001
Create Date: 2026-03-01 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "finance_categories_001"
down_revision: str | None = "finances_001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "finance_categories",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("slug", sa.String(length=50), nullable=False),
        sa.Column("category_type", sa.String(length=10), nullable=False),
        sa.Column("color", sa.String(length=20), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "slug", name="finance_categories_user_id_slug_key"),
    )
    op.create_index("ix_finance_categories_user_id", "finance_categories", ["user_id"])
    op.create_index("ix_finance_categories_slug", "finance_categories", ["slug"])


def downgrade() -> None:
    op.drop_index("ix_finance_categories_slug", table_name="finance_categories")
    op.drop_index("ix_finance_categories_user_id", table_name="finance_categories")
    op.drop_table("finance_categories")
