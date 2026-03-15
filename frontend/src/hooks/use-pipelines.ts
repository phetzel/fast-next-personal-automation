"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { usePipelinesQuery } from "./queries/pipelines";
import type {
  ExecutionState,
  ExecutionStatus,
  PipelineExecuteResponse,
  PipelineFilters,
  PipelineListResponse,
} from "@/types";
import { toSearchParams } from "./queries/utils";

const EMPTY_PIPELINES = [] as PipelineListResponse["pipelines"];
const DEFAULT_EXECUTION_STATE: ExecutionState = {
  status: "idle",
  result: null,
  startedAt: null,
  completedAt: null,
  lastInput: null,
};

export function usePipelines(filters?: PipelineFilters) {
  const queryClient = useQueryClient();
  const [activeFilters, setActiveFilters] = useState<PipelineFilters | undefined>(filters);
  const [error, setError] = useState<string | null>(null);
  const executionsQuery = useQuery({
    queryKey: queryKeys.pipelines.executions(),
    queryFn: () => ({}) as Record<string, ExecutionState>,
    initialData: {} as Record<string, ExecutionState>,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  useEffect(() => {
    setActiveFilters(filters);
  }, [filters]);

  const startExecution = useCallback(
    (pipelineName: string, input?: Record<string, unknown>) => {
      queryClient.setQueryData<Record<string, ExecutionState>>(
        queryKeys.pipelines.executions(),
        (currentExecutions = {}) => ({
          ...currentExecutions,
          [pipelineName]: {
            status: "running" as ExecutionStatus,
            result: null,
            startedAt: new Date(),
            completedAt: null,
            lastInput: input ?? currentExecutions[pipelineName]?.lastInput ?? null,
          },
        })
      );
    },
    [queryClient]
  );

  const completeExecution = useCallback(
    (pipelineName: string, result: PipelineExecuteResponse) => {
      queryClient.setQueryData<Record<string, ExecutionState>>(
        queryKeys.pipelines.executions(),
        (currentExecutions = {}) => ({
          ...currentExecutions,
          [pipelineName]: {
            status: result.success ? ("success" as ExecutionStatus) : ("error" as ExecutionStatus),
            result,
            startedAt: currentExecutions[pipelineName]?.startedAt ?? null,
            completedAt: new Date(),
            lastInput: currentExecutions[pipelineName]?.lastInput ?? null,
          },
        })
      );
    },
    [queryClient]
  );

  const failExecution = useCallback(
    (pipelineName: string, message: string) => {
      queryClient.setQueryData<Record<string, ExecutionState>>(
        queryKeys.pipelines.executions(),
        (currentExecutions = {}) => ({
          ...currentExecutions,
          [pipelineName]: {
            status: "error" as ExecutionStatus,
            result: {
              success: false,
              output: null,
              error: message,
              metadata: {},
            },
            startedAt: currentExecutions[pipelineName]?.startedAt ?? null,
            completedAt: new Date(),
            lastInput: currentExecutions[pipelineName]?.lastInput ?? null,
          },
        })
      );
    },
    [queryClient]
  );

  const resetExecution = useCallback(
    (pipelineName: string) => {
      queryClient.setQueryData<Record<string, ExecutionState>>(
        queryKeys.pipelines.executions(),
        (currentExecutions = {}) => ({
          ...currentExecutions,
          [pipelineName]: DEFAULT_EXECUTION_STATE,
        })
      );
    },
    [queryClient]
  );

  const getExecutionState = useCallback(
    (pipelineName: string) => executionsQuery.data[pipelineName] ?? DEFAULT_EXECUTION_STATE,
    [executionsQuery.data]
  );

  const pipelinesQuery = usePipelinesQuery(activeFilters);

  const executeMutation = useMutation({
    mutationFn: ({
      pipelineName,
      input,
    }: {
      pipelineName: string;
      input: Record<string, unknown>;
    }) => apiClient.post<PipelineExecuteResponse>(`/pipelines/${pipelineName}/execute`, input),
  });

  const fetchPipelines = useCallback(
    async (fetchFilters?: PipelineFilters) => {
      const nextFilters = fetchFilters ?? activeFilters;
      const queryString = toSearchParams({
        area: nextFilters?.area,
        tags: nextFilters?.tags,
      });

      setActiveFilters(nextFilters);
      setError(null);

      try {
        const data = await queryClient.fetchQuery({
          queryKey: queryKeys.pipelines.list(nextFilters ?? {}),
          queryFn: () =>
            apiClient.get<PipelineListResponse>(
              queryString ? `/pipelines?${queryString}` : "/pipelines"
            ),
        });
        return data.pipelines;
      } catch (queryError) {
        const message =
          queryError instanceof Error ? queryError.message : "Failed to fetch pipelines";
        setError(message);
        return [];
      }
    },
    [activeFilters, queryClient]
  );

  const executePipeline = useCallback(
    async (pipelineName: string, input: Record<string, unknown>) => {
      startExecution(pipelineName, input);
      setError(null);

      try {
        const result = await executeMutation.mutateAsync({ pipelineName, input });
        completeExecution(pipelineName, result);
        return result;
      } catch (mutationError) {
        const message =
          mutationError instanceof Error ? mutationError.message : "Pipeline execution failed";
        failExecution(pipelineName, message);
        setError(message);
        return null;
      }
    },
    [completeExecution, executeMutation, failExecution, startExecution]
  );

  const pipelines = pipelinesQuery.data?.pipelines ?? EMPTY_PIPELINES;
  const availableAreas = useMemo(() => {
    const areas = new Set<string>();
    pipelines.forEach((pipeline) => {
      if (pipeline.area) {
        areas.add(pipeline.area);
      }
    });
    return Array.from(areas).sort();
  }, [pipelines]);

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    pipelines.forEach((pipeline) => {
      pipeline.tags.forEach((tag) => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [pipelines]);

  return {
    pipelines,
    isLoading: pipelinesQuery.isLoading || pipelinesQuery.isFetching,
    error: error ?? (pipelinesQuery.error instanceof Error ? pipelinesQuery.error.message : null),
    executions: executionsQuery.data,
    availableAreas,
    availableTags,
    fetchPipelines,
    executePipeline,
    resetExecution,
    getExecutionState,
    filterByArea: (area: string) => pipelines.filter((pipeline) => pipeline.area === area),
    filterByTags: (tags: string[]) =>
      pipelines.filter((pipeline) => tags.every((tag) => pipeline.tags.includes(tag))),
  };
}
