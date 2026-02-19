"""Task for executing scheduled pipelines from the database scheduler."""

import logging
from typing import Any
from uuid import UUID

from app.worker.taskiq_app import broker

logger = logging.getLogger(__name__)


@broker.task()
async def execute_scheduled_pipeline(
    scheduled_task_id: str,
    pipeline_name: str,
    user_id: str,
    input_params: dict[str, Any] | None = None,
) -> dict:
    """Execute a pipeline from a scheduled task.

    This task is invoked by the DatabaseScheduleSource when a scheduled
    time is reached. It executes the specified pipeline with the given
    input parameters.

    Args:
        scheduled_task_id: UUID of the ScheduledTask record.
        pipeline_name: Name of the pipeline to execute.
        user_id: UUID of the user who owns the schedule.
        input_params: Optional input parameters for the pipeline.

    Returns:
        Dict with execution results including success status,
        output data, and any errors.
    """
    from app.db.session import get_db_context
    from app.pipelines.action_base import PipelineContext, PipelineSource
    from app.pipelines.registry import execute_pipeline

    logger.info(
        f"Executing scheduled pipeline '{pipeline_name}' "
        f"(task_id={scheduled_task_id}, user_id={user_id})"
    )

    result_data = {
        "scheduled_task_id": scheduled_task_id,
        "pipeline_name": pipeline_name,
        "user_id": user_id,
        "success": False,
        "output": None,
        "error": None,
    }

    try:
        context = PipelineContext(
            source=PipelineSource.CRON,
            user_id=UUID(user_id),
            metadata={"scheduled_task_id": scheduled_task_id},
        )

        async with get_db_context() as db:
            result = await execute_pipeline(
                pipeline_name,
                input_params or {},
                context,
                db=db,
            )

            result_data["success"] = result.success
            if result.output:
                result_data["output"] = result.output.model_dump(mode="json")
            if result.error:
                result_data["error"] = result.error

            await db.commit()

        if result.success:
            logger.info(f"Scheduled pipeline '{pipeline_name}' completed successfully")
        else:
            logger.error(f"Scheduled pipeline '{pipeline_name}' failed: {result.error}")

    except Exception as e:
        logger.exception(f"Error executing scheduled pipeline '{pipeline_name}': {e}")
        result_data["error"] = str(e)

    return result_data
