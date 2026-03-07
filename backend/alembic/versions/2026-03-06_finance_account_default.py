"""Add default-account support to finance accounts.

Revision ID: finance_account_default_001
Revises: integration_tokens_001
Create Date: 2026-03-06 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "finance_account_default_001"
down_revision: str | None = "integration_tokens_001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "finance_accounts",
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index(
        "ix_finance_accounts_is_default",
        "finance_accounts",
        ["is_default"],
        unique=False,
    )

    op.execute(
        """
        WITH ranked_accounts AS (
            SELECT
                id,
                ROW_NUMBER() OVER (
                    PARTITION BY user_id
                    ORDER BY created_at ASC, id ASC
                ) AS row_num
            FROM finance_accounts
            WHERE is_active = true
        )
        UPDATE finance_accounts AS account
        SET is_default = true
        FROM ranked_accounts
        WHERE account.id = ranked_accounts.id
          AND ranked_accounts.row_num = 1
        """
    )

    op.create_index(
        "finance_accounts_user_id_default_idx",
        "finance_accounts",
        ["user_id"],
        unique=True,
        postgresql_where=sa.text("is_default = true"),
    )


def downgrade() -> None:
    op.drop_index("finance_accounts_user_id_default_idx", table_name="finance_accounts")
    op.drop_index("ix_finance_accounts_is_default", table_name="finance_accounts")
    op.drop_column("finance_accounts", "is_default")
