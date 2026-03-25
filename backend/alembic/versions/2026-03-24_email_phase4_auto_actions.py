"""email phase 4 auto-action settings

Add auto_actions_enabled and auto_action_confidence_threshold columns
to email_sources for per-account auto-action configuration.

Revision ID: email_phase4_001
Revises: email_triage_phase3_001
Create Date: 2026-03-24 12:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "email_phase4_001"
down_revision: str | None = "email_triage_phase3_001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "email_sources",
        sa.Column("auto_actions_enabled", sa.Boolean(), nullable=False, server_default="true"),
    )
    op.add_column(
        "email_sources",
        sa.Column(
            "auto_action_confidence_threshold",
            sa.Float(),
            nullable=False,
            server_default="0.95",
        ),
    )


def downgrade() -> None:
    op.drop_column("email_sources", "auto_action_confidence_threshold")
    op.drop_column("email_sources", "auto_actions_enabled")
