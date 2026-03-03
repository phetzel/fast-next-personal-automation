"""Fix finance_categories.updated_at to be nullable, matching TimestampMixin.

Revision ID: fix_finance_categories_updated_at_001
Revises: recurring_expense_account_id_001
Create Date: 2026-03-03 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "fix_categories_updated_at_001"
down_revision: str | None = "recurring_expense_account_id_001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "finance_categories",
        "updated_at",
        existing_type=sa.DateTime(timezone=True),
        nullable=True,
        existing_server_default=sa.text("now()"),
    )


def downgrade() -> None:
    # Fill any nulls before restoring NOT NULL constraint
    op.execute("UPDATE finance_categories SET updated_at = created_at WHERE updated_at IS NULL")
    op.alter_column(
        "finance_categories",
        "updated_at",
        existing_type=sa.DateTime(timezone=True),
        nullable=False,
        existing_server_default=sa.text("now()"),
    )
