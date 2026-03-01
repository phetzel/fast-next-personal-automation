"""Finance Categorize Pipeline.

AI-categorizes uncategorized financial transactions in batches.
"""

import logging
from typing import ClassVar
from uuid import UUID

from pydantic import BaseModel, Field

from app.db.session import get_db_context
from app.pipelines.action_base import ActionPipeline, ActionResult, PipelineContext
from app.pipelines.registry import register_pipeline

logger = logging.getLogger(__name__)


class FinanceCategorizeInput(BaseModel):
    limit: int = Field(
        default=100,
        ge=1,
        le=500,
        description="Maximum number of uncategorized transactions to process per run.",
    )
    account_id: UUID | None = Field(
        default=None,
        description="Optional: restrict to transactions from a specific account.",
    )


class FinanceCategorizeOutput(BaseModel):
    categorized: int = 0
    failed: int = 0
    skipped: int = 0


@register_pipeline
class FinanceCategorizePipeline(ActionPipeline[FinanceCategorizeInput, FinanceCategorizeOutput]):
    """Finance AI categorization pipeline.

    Finds uncategorized transactions and assigns categories using OpenAI.
    Categories are assigned with a confidence score; the user can override any category.

    Can be triggered via:
    - API: POST /api/v1/pipelines/finance_categorize/execute
    - Finance transactions page (bulk categorize button)
    - Finance area assistant
    """

    name = "finance_categorize"
    description = "AI-categorize uncategorized financial transactions"
    tags: ClassVar[list[str]] = ["finances", "ai"]
    area: ClassVar[str | None] = "finances"

    async def execute(
        self,
        input: FinanceCategorizeInput,
        context: PipelineContext,
    ) -> ActionResult[FinanceCategorizeOutput]:
        if context.user_id is None:
            return ActionResult(success=False, error="User authentication required")

        async with get_db_context() as db:
            from app.services.finance_service import FinanceService

            service = FinanceService(db)
            categorized, failed = await service.categorize_with_ai(
                user_id=context.user_id,
                limit=input.limit,
                account_id=input.account_id,
            )
            await db.commit()

        return ActionResult(
            success=True,
            output=FinanceCategorizeOutput(categorized=categorized, failed=failed),
            metadata={"categorized": categorized, "failed": failed},
        )
