"""Make budget category nullable for general (all-expenses) budgets.

Revision ID: budget_nullable_category_001
Revises: finance_categories_001
Create Date: 2026-03-02 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "budget_nullable_category_001"
down_revision: str | None = "finance_categories_001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Drop the existing unique constraint (includes category)
    op.drop_constraint("budgets_user_id_category_month_year_key", "budgets", type_="unique")

    # Make category nullable
    op.alter_column("budgets", "category", nullable=True)

    # Re-add uniqueness: one budget per category per user/month/year (excluding nulls)
    op.create_index(
        "budgets_user_id_category_month_year_idx",
        "budgets",
        ["user_id", "category", "month", "year"],
        unique=True,
        postgresql_where=sa.text("category IS NOT NULL"),
    )

    # Allow at most one null-category budget per user/month/year
    op.create_index(
        "budgets_user_id_month_year_general_idx",
        "budgets",
        ["user_id", "month", "year"],
        unique=True,
        postgresql_where=sa.text("category IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("budgets_user_id_month_year_general_idx", table_name="budgets")
    op.drop_index("budgets_user_id_category_month_year_idx", table_name="budgets")
    op.alter_column("budgets", "category", nullable=False)
    op.create_unique_constraint(
        "budgets_user_id_category_month_year_key",
        "budgets",
        ["user_id", "category", "month", "year"],
    )
