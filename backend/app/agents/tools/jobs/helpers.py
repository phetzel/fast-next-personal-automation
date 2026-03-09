"""Shared helpers for jobs area agent tools."""

from uuid import UUID

from pydantic_ai import RunContext


def get_db_and_user(ctx: RunContext) -> tuple:
    """Extract db session and user_id from context, with validation.

    Returns:
        (db, user_id, error) where error is None on success.
    """
    if not ctx.deps.db:
        return None, None, "Database session not available"
    if not ctx.deps.user_id:
        return None, None, "User not authenticated"
    try:
        user_id = UUID(ctx.deps.user_id)
    except ValueError:
        return None, None, "Invalid user ID"
    return ctx.deps.db, user_id, None
