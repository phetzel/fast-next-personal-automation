"use client";

import { PipelineCard } from "./pipeline-card";
import { usePipelines } from "@/hooks";
import { Loader2, AlertCircle, Workflow } from "lucide-react";
import { Button } from "@/components/ui";

/**
 * Displays a grid of available pipelines.
 */
export function PipelineList() {
  const {
    pipelines,
    isLoading,
    error,
    fetchPipelines,
    executePipeline,
    resetExecution,
    getExecutionState,
  } = usePipelines();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
        <p className="text-muted-foreground mt-4 text-sm">Loading pipelines...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-8 w-8 text-red-500" />
        <p className="mt-4 text-sm text-red-500">{error}</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={fetchPipelines}>
          Retry
        </Button>
      </div>
    );
  }

  if (pipelines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="bg-muted rounded-full p-4">
          <Workflow className="text-muted-foreground h-8 w-8" />
        </div>
        <h3 className="mt-4 text-lg font-medium">No pipelines available</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          Create a pipeline in the backend to see it here.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
      {pipelines.map((pipeline) => (
        <PipelineCard
          key={pipeline.name}
          pipeline={pipeline}
          executionState={getExecutionState(pipeline.name)}
          onExecute={(input) => executePipeline(pipeline.name, input)}
          onReset={() => resetExecution(pipeline.name)}
        />
      ))}
    </div>
  );
}

