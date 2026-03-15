"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type {
  PipelineFilters,
  PipelineListResponse,
  PipelineRun,
  PipelineRunFilters,
  PipelineRunListResponse,
  PipelineRunStats,
} from "@/types";
import { toSearchParams } from "./utils";

export function usePipelinesQuery(filters?: PipelineFilters) {
  const queryString = toSearchParams({
    area: filters?.area,
    tags: filters?.tags,
  });

  return useQuery({
    queryKey: queryKeys.pipelines.list(filters ?? {}),
    queryFn: () =>
      apiClient.get<PipelineListResponse>(queryString ? `/pipelines?${queryString}` : "/pipelines"),
  });
}

export function usePipelineRunsQuery(filters: PipelineRunFilters) {
  const queryString = toSearchParams({
    pipeline_name: filters.pipeline_name,
    status: filters.status,
    trigger_type: filters.trigger_type,
    started_after: filters.started_after,
    started_before: filters.started_before,
    success_only: filters.success_only,
    error_only: filters.error_only,
    my_runs_only: filters.my_runs_only,
    page: filters.page || 1,
    page_size: filters.page_size || 20,
  });

  return useQuery({
    queryKey: queryKeys.pipelines.runs(filters),
    queryFn: () => apiClient.get<PipelineRunListResponse>(`/pipelines/runs?${queryString}`),
  });
}

export function usePipelineRunStatsQuery(pipelineName?: string, sinceHours = 24) {
  const queryString = toSearchParams({
    pipeline_name: pipelineName,
    since_hours: sinceHours,
  });

  return useQuery({
    queryKey: queryKeys.pipelines.stats(pipelineName, sinceHours),
    queryFn: () => apiClient.get<PipelineRunStats>(`/pipelines/runs/stats?${queryString}`),
  });
}

export function usePipelineRunQuery(runId: string | null) {
  return useQuery({
    queryKey: runId ? queryKeys.pipelines.run(runId) : [...queryKeys.pipelines.all, "run", null],
    queryFn: () => apiClient.get<PipelineRun>(`/pipelines/runs/${runId}`),
    enabled: Boolean(runId),
  });
}
