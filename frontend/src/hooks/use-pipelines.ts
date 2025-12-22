"use client";

import { useCallback, useEffect } from "react";
import { usePipelineStore } from "@/stores";
import { apiClient } from "@/lib/api-client";
import type { PipelineListResponse, PipelineExecuteResponse } from "@/types";

/**
 * Hook for managing pipelines - fetching, executing, and tracking state.
 */
export function usePipelines() {
  const {
    pipelines,
    isLoading,
    error,
    executions,
    setPipelines,
    setLoading,
    setError,
    startExecution,
    completeExecution,
    failExecution,
    resetExecution,
    getExecutionState,
  } = usePipelineStore();

  // Fetch pipelines on mount
  const fetchPipelines = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await apiClient.get<PipelineListResponse>("/pipelines");
      setPipelines(data.pipelines);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch pipelines";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [setPipelines, setLoading, setError]);

  // Execute a pipeline
  const executePipeline = useCallback(
    async (pipelineName: string, input: Record<string, unknown>) => {
      startExecution(pipelineName);

      try {
        const result = await apiClient.post<PipelineExecuteResponse>(
          `/pipelines/${pipelineName}/execute`,
          input
        );
        completeExecution(pipelineName, result);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Pipeline execution failed";
        failExecution(pipelineName, message);
        return null;
      }
    },
    [startExecution, completeExecution, failExecution]
  );

  // Auto-fetch on mount
  useEffect(() => {
    if (pipelines.length === 0 && !isLoading) {
      fetchPipelines();
    }
  }, [pipelines.length, isLoading, fetchPipelines]);

  return {
    // Data
    pipelines,
    isLoading,
    error,
    executions,

    // Actions
    fetchPipelines,
    executePipeline,
    resetExecution,
    getExecutionState,
  };
}

