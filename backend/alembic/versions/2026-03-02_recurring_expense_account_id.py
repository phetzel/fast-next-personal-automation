"""Add account_id to recurring_expenses for auto-deduct on due date.

Revision ID: recurring_expense_account_id_001
Revises: budget_nullable_category_001
Create Date: 2026-03-02 01:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "recurring_expense_account_id_001"
down_revision: str | None = "budget_nullable_category_001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "recurring_expenses",
        sa.Column("account_id", sa.UUID(), nullable=True),
    )
    op.create_foreign_key(
        "recurring_expenses_account_id_fkey",
        "recurring_expenses",
        "financial_accounts",
        ["account_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_recurring_expenses_account_id", "recurring_expenses", ["account_id"])


def downgrade() -> None:
    op.drop_index("ix_recurring_expenses_account_id", table_name="recurring_expenses")
    op.drop_constraint(
        "recurring_expenses_account_id_fkey", "recurring_expenses", type_="foreignkey"
    )
    op.drop_column("recurring_expenses", "account_id")
