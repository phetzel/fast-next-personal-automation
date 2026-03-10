"""Rename finance tables to use consistent finance_ prefix.

financial_accounts   -> finance_accounts
transactions         -> finance_transactions
budgets              -> finance_budgets
recurring_expenses   -> finance_recurring_expenses

Revision ID: rename_finance_tables_001
Revises: fix_categories_updated_at_001
Create Date: 2026-03-03 01:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

revision: str = "rename_finance_tables_001"
down_revision: str | None = "fix_categories_updated_at_001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ── Rename tables ──────────────────────────────────────────────────────────
    op.execute("ALTER TABLE financial_accounts RENAME TO finance_accounts")
    op.execute("ALTER TABLE transactions RENAME TO finance_transactions")
    op.execute("ALTER TABLE budgets RENAME TO finance_budgets")
    op.execute("ALTER TABLE recurring_expenses RENAME TO finance_recurring_expenses")

    # ── Rename indexes: finance_accounts ──────────────────────────────────────
    op.execute("ALTER INDEX financial_accounts_user_id_idx RENAME TO finance_accounts_user_id_idx")

    # ── Rename indexes: finance_transactions ──────────────────────────────────
    op.execute("ALTER INDEX transactions_user_id_idx RENAME TO finance_transactions_user_id_idx")
    op.execute(
        "ALTER INDEX transactions_account_id_idx RENAME TO finance_transactions_account_id_idx"
    )
    op.execute(
        "ALTER INDEX transactions_transaction_date_idx "
        "RENAME TO finance_transactions_transaction_date_idx"
    )
    op.execute("ALTER INDEX transactions_category_idx RENAME TO finance_transactions_category_idx")
    op.execute("ALTER INDEX transactions_source_idx RENAME TO finance_transactions_source_idx")
    op.execute(
        "ALTER INDEX transactions_is_reviewed_idx RENAME TO finance_transactions_is_reviewed_idx"
    )
    op.execute(
        "ALTER INDEX transactions_recurring_expense_id_idx "
        "RENAME TO finance_transactions_recurring_expense_id_idx"
    )
    op.execute(
        "ALTER INDEX transactions_user_id_raw_email_id_idx "
        "RENAME TO finance_transactions_user_id_raw_email_id_idx"
    )

    # ── Rename indexes: finance_budgets ───────────────────────────────────────
    op.execute("ALTER INDEX budgets_user_id_idx RENAME TO finance_budgets_user_id_idx")
    op.execute("ALTER INDEX budgets_category_idx RENAME TO finance_budgets_category_idx")
    op.execute(
        "ALTER INDEX budgets_user_id_category_month_year_idx "
        "RENAME TO finance_budgets_user_id_category_month_year_idx"
    )
    op.execute(
        "ALTER INDEX budgets_user_id_month_year_general_idx "
        "RENAME TO finance_budgets_user_id_month_year_general_idx"
    )

    # ── Rename indexes: finance_recurring_expenses ────────────────────────────
    op.execute(
        "ALTER INDEX recurring_expenses_user_id_idx "
        "RENAME TO finance_recurring_expenses_user_id_idx"
    )
    op.execute(
        "ALTER INDEX recurring_expenses_category_idx "
        "RENAME TO finance_recurring_expenses_category_idx"
    )
    op.execute(
        "ALTER INDEX recurring_expenses_is_active_idx "
        "RENAME TO finance_recurring_expenses_is_active_idx"
    )
    op.execute(
        "ALTER INDEX ix_recurring_expenses_account_id "
        "RENAME TO ix_finance_recurring_expenses_account_id"
    )


def downgrade() -> None:
    # ── Restore indexes: finance_recurring_expenses ───────────────────────────
    op.execute(
        "ALTER INDEX ix_finance_recurring_expenses_account_id "
        "RENAME TO ix_recurring_expenses_account_id"
    )
    op.execute(
        "ALTER INDEX finance_recurring_expenses_is_active_idx "
        "RENAME TO recurring_expenses_is_active_idx"
    )
    op.execute(
        "ALTER INDEX finance_recurring_expenses_category_idx "
        "RENAME TO recurring_expenses_category_idx"
    )
    op.execute(
        "ALTER INDEX finance_recurring_expenses_user_id_idx "
        "RENAME TO recurring_expenses_user_id_idx"
    )

    # ── Restore indexes: finance_budgets ──────────────────────────────────────
    op.execute(
        "ALTER INDEX finance_budgets_user_id_month_year_general_idx "
        "RENAME TO budgets_user_id_month_year_general_idx"
    )
    op.execute(
        "ALTER INDEX finance_budgets_user_id_category_month_year_idx "
        "RENAME TO budgets_user_id_category_month_year_idx"
    )
    op.execute("ALTER INDEX finance_budgets_category_idx RENAME TO budgets_category_idx")
    op.execute("ALTER INDEX finance_budgets_user_id_idx RENAME TO budgets_user_id_idx")

    # ── Restore indexes: finance_transactions ─────────────────────────────────
    op.execute(
        "ALTER INDEX finance_transactions_user_id_raw_email_id_idx "
        "RENAME TO transactions_user_id_raw_email_id_idx"
    )
    op.execute(
        "ALTER INDEX finance_transactions_recurring_expense_id_idx "
        "RENAME TO transactions_recurring_expense_id_idx"
    )
    op.execute(
        "ALTER INDEX finance_transactions_is_reviewed_idx RENAME TO transactions_is_reviewed_idx"
    )
    op.execute("ALTER INDEX finance_transactions_source_idx RENAME TO transactions_source_idx")
    op.execute("ALTER INDEX finance_transactions_category_idx RENAME TO transactions_category_idx")
    op.execute(
        "ALTER INDEX finance_transactions_transaction_date_idx "
        "RENAME TO transactions_transaction_date_idx"
    )
    op.execute(
        "ALTER INDEX finance_transactions_account_id_idx RENAME TO transactions_account_id_idx"
    )
    op.execute("ALTER INDEX finance_transactions_user_id_idx RENAME TO transactions_user_id_idx")

    # ── Restore indexes: finance_accounts ─────────────────────────────────────
    op.execute("ALTER INDEX finance_accounts_user_id_idx RENAME TO financial_accounts_user_id_idx")

    # ── Restore tables ────────────────────────────────────────────────────────
    op.execute("ALTER TABLE finance_recurring_expenses RENAME TO recurring_expenses")
    op.execute("ALTER TABLE finance_budgets RENAME TO budgets")
    op.execute("ALTER TABLE finance_transactions RENAME TO transactions")
    op.execute("ALTER TABLE finance_accounts RENAME TO financial_accounts")
