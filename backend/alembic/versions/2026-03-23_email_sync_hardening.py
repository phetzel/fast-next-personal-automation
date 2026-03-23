"""email sync hardening

Revision ID: email_sync_hardening_001
Revises: job_workflow_refactor_001
Create Date: 2026-03-23 12:00:00.000000

Encrypts any legacy plaintext OAuth tokens and hardens email message deduplication.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "email_sync_hardening_001"
down_revision: str | None = "job_workflow_refactor_001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    from app.core.security import encrypt_token, is_encrypted

    bind = op.get_bind()

    # Remove duplicate rows before adding the uniqueness guarantee.
    bind.execute(
        sa.text(
            """
            WITH ranked AS (
                SELECT
                    id,
                    ROW_NUMBER() OVER (
                        PARTITION BY source_id, gmail_message_id
                        ORDER BY created_at ASC, id ASC
                    ) AS row_num
                FROM email_messages
            )
            DELETE FROM email_messages
            WHERE id IN (
                SELECT id
                FROM ranked
                WHERE row_num > 1
            )
            """
        )
    )

    op.create_unique_constraint(
        "email_messages_source_id_gmail_message_id_key",
        "email_messages",
        ["source_id", "gmail_message_id"],
    )

    rows = bind.execute(
        sa.text(
            """
            SELECT id, access_token, refresh_token
            FROM email_sources
            """
        )
    ).mappings()

    for row in rows:
        access_token = row["access_token"]
        refresh_token = row["refresh_token"]
        encrypted_access = (
            access_token if is_encrypted(access_token) else encrypt_token(access_token)
        )
        encrypted_refresh = (
            refresh_token if is_encrypted(refresh_token) else encrypt_token(refresh_token)
        )

        if encrypted_access == access_token and encrypted_refresh == refresh_token:
            continue

        bind.execute(
            sa.text(
                """
                UPDATE email_sources
                SET access_token = :access_token,
                    refresh_token = :refresh_token
                WHERE id = :id
                """
            ),
            {
                "id": row["id"],
                "access_token": encrypted_access,
                "refresh_token": encrypted_refresh,
            },
        )


def downgrade() -> None:
    op.drop_constraint(
        "email_messages_source_id_gmail_message_id_key",
        "email_messages",
        type_="unique",
    )
