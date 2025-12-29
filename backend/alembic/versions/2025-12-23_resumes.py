"""Add resumes table and update job_profiles.

Revision ID: 6c1ee5fg5678
Revises: 5b0cc4de3456
Create Date: 2025-12-23 14:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "6c1ee5fg5678"
down_revision: str | None = "5b0cc4de3456"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Step 1: Create resumes table
    op.create_table(
        "resumes",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("file_path", sa.String(length=500), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("mime_type", sa.String(length=100), nullable=False),
        sa.Column("text_content", sa.Text(), nullable=True),
        sa.Column("is_primary", sa.Boolean(), nullable=False, default=False),
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
            name="resumes_user_id_fkey",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="resumes_pkey"),
    )

    # Create index for user_id lookups
    op.create_index(
        "resumes_user_id_idx",
        "resumes",
        ["user_id"],
        unique=False,
    )

    # Create partial index for finding primary resume per user
    op.execute(
        "CREATE INDEX resumes_user_primary_idx "
        "ON resumes (user_id, is_primary) WHERE is_primary = TRUE"
    )

    # Step 2: Add resume_id FK to job_profiles (nullable)
    op.add_column(
        "job_profiles",
        sa.Column("resume_id", sa.UUID(), nullable=True),
    )

    op.create_foreign_key(
        "job_profiles_resume_id_fkey",
        "job_profiles",
        "resumes",
        ["resume_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # Create index for resume_id lookups
    op.create_index(
        "job_profiles_resume_id_idx",
        "job_profiles",
        ["resume_id"],
        unique=False,
    )

    # Step 3: Drop resume_text from job_profiles (clean break)
    op.drop_column("job_profiles", "resume_text")


def downgrade() -> None:
    # Reverse the migration - for development only

    # Add resume_text back
    op.add_column(
        "job_profiles",
        sa.Column("resume_text", sa.Text(), nullable=True),
    )

    # Drop resume_id FK and column
    op.drop_index("job_profiles_resume_id_idx", table_name="job_profiles")
    op.drop_constraint("job_profiles_resume_id_fkey", "job_profiles", type_="foreignkey")
    op.drop_column("job_profiles", "resume_id")

    # Drop resumes table
    op.execute("DROP INDEX IF EXISTS resumes_user_primary_idx")
    op.drop_index("resumes_user_id_idx", table_name="resumes")
    op.drop_table("resumes")
