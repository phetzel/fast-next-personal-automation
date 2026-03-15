"use client";

import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import {
  usePipelineRunQuery,
  usePipelineRunsQuery,
  usePipelineRunStatsQuery,
} from "./queries/pipelines";
import type {
  PipelineRunListResponse,
  PipelineRunStats,
  PipelineRunFilters,
  PipelineRun,
} from "@/types";
import { toSearchParams } from "./queries/utils";

const defaultFilters: PipelineRunFilters = {
  page: 1,
  page_size: 20,
};

export function usePipelineRuns() {
  const queryClient = useQueryClient();
  const [filters, setFiltersState] = useState<PipelineRunFilters>(defaultFilters);
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [statsConfig, setStatsConfig] = useState({
    pipelineName: undefined as string | undefined,
    sinceHours: 24,
  });

  const runsQuery = usePipelineRunsQuery(filters);
  const statsQuery = usePipelineRunStatsQuery(statsConfig.pipelineName, statsConfig.sinceHours);
  const selectedRunQuery = usePipelineRunQuery(selectedRunId);

  useEffect(() => {
    if (!runsQuery.data) {
      return;
    }

    setRuns((currentRuns) =>
      (filters.page || 1) > 1
        ? [
            ...currentRuns,
            ...runsQuery.data.runs.filter(
              (run) => !currentRuns.some((currentRun) => currentRun.id === run.id)
            ),
          ]
        : runsQuery.data.runs
    );
  }, [filters.page, runsQuery.data]);

  const fetchRuns = useCallback(
    async (append = false) => {
      const nextFilters = append ? { ...filters, page: (filters.page || 1) + 1 } : filters;
      const queryString = toSearchParams({
        pipeline_name: nextFilters.pipeline_name,
        status: nextFilters.status,
        trigger_type: nextFilters.trigger_type,
        started_after: nextFilters.started_after,
        started_before: nextFilters.started_before,
        success_only: nextFilters.success_only,
        error_only: nextFilters.error_only,
        my_runs_only: nextFilters.my_runs_only,
        page: nextFilters.page || 1,
        page_size: nextFilters.page_size || 20,
      });

      setError(null);
      if (append) {
        setFiltersState(nextFilters);
      }

      try {
        const data = await queryClient.fetchQuery({
          queryKey: queryKeys.pipelines.runs(nextFilters),
          queryFn: () => apiClient.get<PipelineRunListResponse>(`/pipelines/runs?${queryString}`),
        });

        if (!append) {
          setRuns(data.runs);
        }

        return data;
      } catch (queryError) {
        const message =
          queryError instanceof Error ? queryError.message : "Failed to fetch pipeline runs";
        setError(message);
        return null;
      }
    },
    [filters, queryClient]
  );

  const fetchStats = useCallback(
    async (pipelineName?: string, sinceHours = 24) => {
      setStatsConfig({ pipelineName, sinceHours });
      setError(null);

      try {
        return await queryClient.fetchQuery<PipelineRunStats>({
          queryKey: queryKeys.pipelines.stats(pipelineName, sinceHours),
          queryFn: () => {
            const params = toSearchParams({
              pipeline_name: pipelineName,
              since_hours: sinceHours,
            });
            return apiClient.get<PipelineRunStats>(`/pipelines/runs/stats?${params}`);
          },
        });
      } catch {
        return null;
      }
    },
    [queryClient]
  );

  const fetchRun = useCallback(
    async (runId: string): Promise<PipelineRun | null> => {
      setSelectedRunId(runId);
      setError(null);

      try {
        return await queryClient.fetchQuery({
          queryKey: queryKeys.pipelines.run(runId),
          queryFn: () => apiClient.get<PipelineRun>(`/pipelines/runs/${runId}`),
        });
      } catch (queryError) {
        const message =
          queryError instanceof Error ? queryError.message : "Failed to fetch pipeline run";
        setError(message);
        return null;
      }
    },
    [queryClient]
  );

  const updateFilters = useCallback((newFilters: Partial<PipelineRunFilters>) => {
    setRuns([]);
    setFiltersState((currentFilters) => ({
      ...currentFilters,
      ...newFilters,
      page: 1,
    }));
  }, []);

  const resetFilters = useCallback(() => {
    setRuns([]);
    setFiltersState(defaultFilters);
  }, []);

  const setPage = useCallback((page: number) => {
    setFiltersState((currentFilters) => ({ ...currentFilters, page }));
  }, []);

  const setPageSize = useCallback((pageSize: number) => {
    setRuns([]);
    setFiltersState((currentFilters) => ({ ...currentFilters, page: 1, page_size: pageSize }));
  }, []);

  const loadMore = useCallback(() => {
    if (!runsQuery.isFetching && (runsQuery.data?.has_more ?? false)) {
      setFiltersState((currentFilters) => ({
        ...currentFilters,
        page: (currentFilters.page || 1) + 1,
      }));
    }
  }, [runsQuery.data?.has_more, runsQuery.isFetching]);

  const selectedRun = selectedRunQuery.data ?? null;

  return {
    runs,
    total: runsQuery.data?.total ?? 0,
    page: filters.page || 1,
    pageSize: filters.page_size || 20,
    hasMore: runsQuery.data?.has_more ?? false,
    isLoading: runsQuery.isLoading || runsQuery.isFetching,
    error:
      error ??
      (runsQuery.error instanceof Error
        ? runsQuery.error.message
        : selectedRunQuery.error instanceof Error
          ? selectedRunQuery.error.message
          : null),
    filters,
    stats: statsQuery.data ?? null,
    statsLoading: statsQuery.isLoading || statsQuery.isFetching,
    selectedRun,
    fetchRuns,
    fetchStats,
    fetchRun,
    updateFilters,
    resetFilters,
    loadMore,
    setSelectedRun: (run: PipelineRun | null) => setSelectedRunId(run?.id ?? null),
    setPage,
    setPageSize,
  };
}
