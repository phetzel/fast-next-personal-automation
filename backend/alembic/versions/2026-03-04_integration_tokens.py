"""Add integration tokens table for external automation clients.

Revision ID: integration_tokens_001
Revises: rename_finance_tables_001
Create Date: 2026-03-04 13:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "integration_tokens_001"
down_revision: str | None = "rename_finance_tables_001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "integration_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("scopes", postgresql.ARRAY(sa.String()), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("integration_tokens_pkey")),
        sa.UniqueConstraint("token_hash", name=op.f("integration_tokens_token_hash_key")),
    )
    op.create_index(
        op.f("integration_tokens_user_id_idx"), "integration_tokens", ["user_id"], unique=False
    )
    op.create_index(
        op.f("integration_tokens_is_active_idx"), "integration_tokens", ["is_active"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("integration_tokens_is_active_idx"), table_name="integration_tokens")
    op.drop_index(op.f("integration_tokens_user_id_idx"), table_name="integration_tokens")
    op.drop_table("integration_tokens")
