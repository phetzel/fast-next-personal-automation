"""Add finances area tables: financial_accounts, transactions, budgets, recurring_expenses.

Revision ID: finances_001
Revises: drop_job_apply_tracking_001
Create Date: 2026-03-01 10:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "finances_001"
down_revision: str | None = "drop_job_apply_tracking_001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Create financial_accounts table
    op.create_table(
        "financial_accounts",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("institution", sa.String(length=255), nullable=True),
        sa.Column("account_type", sa.String(length=50), nullable=False, server_default="checking"),
        sa.Column("last_four", sa.String(length=4), nullable=True),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="USD"),
        sa.Column("current_balance", sa.Numeric(12, 2), nullable=True),
        sa.Column("balance_updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("financial_accounts_user_id_fkey"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("financial_accounts_pkey")),
        sa.UniqueConstraint("user_id", "name", name="financial_accounts_user_id_name_key"),
    )
    op.create_index(op.f("financial_accounts_user_id_idx"), "financial_accounts", ["user_id"], unique=False)

    # Create recurring_expenses table (before transactions, since transactions has FK to it)
    op.create_table(
        "recurring_expenses",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("merchant", sa.String(length=255), nullable=True),
        sa.Column("category", sa.String(length=50), nullable=True),
        sa.Column("expected_amount", sa.Numeric(12, 2), nullable=True),
        sa.Column("billing_cycle", sa.String(length=20), nullable=False, server_default="monthly"),
        sa.Column("next_due_date", sa.Date(), nullable=True),
        sa.Column("last_seen_date", sa.Date(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("auto_match", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("recurring_expenses_user_id_fkey"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("recurring_expenses_pkey")),
    )
    op.create_index(op.f("recurring_expenses_user_id_idx"), "recurring_expenses", ["user_id"], unique=False)
    op.create_index(op.f("recurring_expenses_category_idx"), "recurring_expenses", ["category"], unique=False)
    op.create_index(op.f("recurring_expenses_is_active_idx"), "recurring_expenses", ["is_active"], unique=False)

    # Create transactions table
    op.create_table(
        "transactions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("account_id", sa.UUID(), nullable=True),
        sa.Column("recurring_expense_id", sa.UUID(), nullable=True),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=False),
        sa.Column("merchant", sa.String(length=255), nullable=True),
        sa.Column("transaction_date", sa.Date(), nullable=False),
        sa.Column("posted_date", sa.Date(), nullable=True),
        sa.Column("transaction_type", sa.String(length=20), nullable=False, server_default="debit"),
        sa.Column("category", sa.String(length=50), nullable=True),
        sa.Column("category_confidence", sa.Numeric(4, 3), nullable=True),
        sa.Column("source", sa.String(length=20), nullable=False, server_default="manual"),
        sa.Column("raw_email_id", sa.String(length=255), nullable=True),
        sa.Column("is_reviewed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("transactions_user_id_fkey"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["account_id"],
            ["financial_accounts.id"],
            name=op.f("transactions_account_id_fkey"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["recurring_expense_id"],
            ["recurring_expenses.id"],
            name=op.f("transactions_recurring_expense_id_fkey"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("transactions_pkey")),
    )
    op.create_index(op.f("transactions_user_id_idx"), "transactions", ["user_id"], unique=False)
    op.create_index(op.f("transactions_account_id_idx"), "transactions", ["account_id"], unique=False)
    op.create_index(op.f("transactions_transaction_date_idx"), "transactions", ["transaction_date"], unique=False)
    op.create_index(op.f("transactions_category_idx"), "transactions", ["category"], unique=False)
    op.create_index(op.f("transactions_source_idx"), "transactions", ["source"], unique=False)
    op.create_index(op.f("transactions_is_reviewed_idx"), "transactions", ["is_reviewed"], unique=False)
    op.create_index(op.f("transactions_recurring_expense_id_idx"), "transactions", ["recurring_expense_id"], unique=False)
    # Partial unique index for email dedup: only unique when raw_email_id is not null
    op.create_index(
        "transactions_user_id_raw_email_id_idx",
        "transactions",
        ["user_id", "raw_email_id"],
        unique=True,
        postgresql_where=sa.text("raw_email_id IS NOT NULL"),
    )

    # Create budgets table
    op.create_table(
        "budgets",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column("month", sa.Integer(), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("amount_limit", sa.Numeric(12, 2), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("budgets_user_id_fkey"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("budgets_pkey")),
        sa.UniqueConstraint(
            "user_id", "category", "month", "year",
            name="budgets_user_id_category_month_year_key",
        ),
    )
    op.create_index(op.f("budgets_user_id_idx"), "budgets", ["user_id"], unique=False)
    op.create_index(op.f("budgets_category_idx"), "budgets", ["category"], unique=False)


def downgrade() -> None:
    # Drop budgets
    op.drop_index(op.f("budgets_category_idx"), table_name="budgets")
    op.drop_index(op.f("budgets_user_id_idx"), table_name="budgets")
    op.drop_table("budgets")

    # Drop transactions
    op.drop_index("transactions_user_id_raw_email_id_idx", table_name="transactions")
    op.drop_index(op.f("transactions_recurring_expense_id_idx"), table_name="transactions")
    op.drop_index(op.f("transactions_is_reviewed_idx"), table_name="transactions")
    op.drop_index(op.f("transactions_source_idx"), table_name="transactions")
    op.drop_index(op.f("transactions_category_idx"), table_name="transactions")
    op.drop_index(op.f("transactions_transaction_date_idx"), table_name="transactions")
    op.drop_index(op.f("transactions_account_id_idx"), table_name="transactions")
    op.drop_index(op.f("transactions_user_id_idx"), table_name="transactions")
    op.drop_table("transactions")

    # Drop recurring_expenses
    op.drop_index(op.f("recurring_expenses_is_active_idx"), table_name="recurring_expenses")
    op.drop_index(op.f("recurring_expenses_category_idx"), table_name="recurring_expenses")
    op.drop_index(op.f("recurring_expenses_user_id_idx"), table_name="recurring_expenses")
    op.drop_table("recurring_expenses")

    # Drop financial_accounts
    op.drop_index(op.f("financial_accounts_user_id_idx"), table_name="financial_accounts")
    op.drop_table("financial_accounts")
