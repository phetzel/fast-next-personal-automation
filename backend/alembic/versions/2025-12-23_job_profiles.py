"""Rename user_profiles to job_profiles with multi-profile support.

Revision ID: 5b0cc4de3456
Revises: 5c1dd5ef4567
Create Date: 2025-12-23 10:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "5b0cc4de3456"
down_revision: str | None = "4a9bb3cd2345"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Step 1: Add new columns to existing table
    op.add_column(
        "user_profiles",
        sa.Column("name", sa.String(length=100), nullable=True),
    )
    op.add_column(
        "user_profiles",
        sa.Column("is_default", sa.Boolean(), nullable=True),
    )

    # Step 2: Set default values for existing rows
    op.execute("UPDATE user_profiles SET name = 'Default Profile', is_default = TRUE")

    # Step 3: Make columns NOT NULL after setting values
    op.alter_column("user_profiles", "name", nullable=False)
    op.alter_column("user_profiles", "is_default", nullable=False)

    # Step 4: Drop the unique constraint on user_id (allows multiple profiles per user)
    op.drop_constraint("user_profiles_user_id_key", "user_profiles", type_="unique")
    op.drop_index("user_profiles_user_id_idx", table_name="user_profiles")

    # Step 5: Rename the table
    op.rename_table("user_profiles", "job_profiles")

    # Step 6: Add new constraints and indexes
    # Unique constraint on (user_id, name) - can't have duplicate profile names per user
    op.create_unique_constraint(
        "job_profiles_user_id_name_key",
        "job_profiles",
        ["user_id", "name"],
    )

    # Index for user_id lookups (non-unique now)
    op.create_index(
        "job_profiles_user_id_idx",
        "job_profiles",
        ["user_id"],
        unique=False,
    )

    # Partial index for finding default profile
    op.execute(
        "CREATE INDEX job_profiles_user_default_idx "
        "ON job_profiles (user_id, is_default) WHERE is_default = TRUE"
    )

    # Step 7: Update foreign key constraint name
    op.drop_constraint("user_profiles_user_id_fkey", "job_profiles", type_="foreignkey")
    op.create_foreign_key(
        "job_profiles_user_id_fkey",
        "job_profiles",
        "users",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # Step 8: Update primary key constraint name
    op.drop_constraint("user_profiles_pkey", "job_profiles", type_="primary")
    op.create_primary_key("job_profiles_pkey", "job_profiles", ["id"])


def downgrade() -> None:
    # Reverse the migration - for development only, not meant for production use

    # Drop new indexes and constraints
    op.execute("DROP INDEX IF EXISTS job_profiles_user_default_idx")
    op.drop_index("job_profiles_user_id_idx", table_name="job_profiles")
    op.drop_constraint("job_profiles_user_id_name_key", "job_profiles", type_="unique")

    # Update primary key and foreign key names back
    op.drop_constraint("job_profiles_pkey", "job_profiles", type_="primary")
    op.create_primary_key("user_profiles_pkey", "job_profiles", ["id"])

    op.drop_constraint("job_profiles_user_id_fkey", "job_profiles", type_="foreignkey")
    op.create_foreign_key(
        "user_profiles_user_id_fkey",
        "job_profiles",
        "users",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # Rename table back
    op.rename_table("job_profiles", "user_profiles")

    # Restore unique constraint on user_id (only keeping first profile per user)
    op.execute(
        """
        DELETE FROM user_profiles a
        USING user_profiles b
        WHERE a.id > b.id AND a.user_id = b.user_id
        """
    )
    op.create_unique_constraint("user_profiles_user_id_key", "user_profiles", ["user_id"])
    op.create_index(
        "user_profiles_user_id_idx",
        "user_profiles",
        ["user_id"],
        unique=True,
    )

    # Drop new columns
    op.drop_column("user_profiles", "is_default")
    op.drop_column("user_profiles", "name")
