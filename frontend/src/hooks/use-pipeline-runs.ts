"use client";

import { useCallback, useEffect } from "react";
import { usePipelineRunStore } from "@/stores";
import { apiClient } from "@/lib/api-client";
import type {
  PipelineRunListResponse,
  PipelineRunStats,
  PipelineRunFilters,
  PipelineRun,
} from "@/types";

/**
 * Hook for managing pipeline run history - fetching, filtering, and stats.
 */
export function usePipelineRuns() {
  const {
    runs,
    total,
    page,
    pageSize,
    hasMore,
    isLoading,
    error,
    filters,
    stats,
    statsLoading,
    selectedRun,
    setRuns,
    appendRuns,
    setLoading,
    setError,
    setFilters,
    resetFilters,
    setStats,
    setStatsLoading,
    setSelectedRun,
    setPage,
    setPageSize,
  } = usePipelineRunStore();

  // Build query string from filters
  const buildQueryString = useCallback((f: PipelineRunFilters): string => {
    const params = new URLSearchParams();

    if (f.pipeline_name) params.set("pipeline_name", f.pipeline_name);
    if (f.status) params.set("status", f.status);
    if (f.trigger_type) params.set("trigger_type", f.trigger_type);
    if (f.started_after) params.set("started_after", f.started_after);
    if (f.started_before) params.set("started_before", f.started_before);
    if (f.success_only) params.set("success_only", "true");
    if (f.error_only) params.set("error_only", "true");
    if (f.my_runs_only) params.set("my_runs_only", "true");
    params.set("page", String(f.page || 1));
    params.set("page_size", String(f.page_size || 20));

    return params.toString();
  }, []);

  // Fetch runs with current filters
  const fetchRuns = useCallback(
    async (append = false) => {
      setLoading(true);
      setError(null);

      try {
        const queryString = buildQueryString(filters);
        const data = await apiClient.get<PipelineRunListResponse>(
          `/pipelines/runs?${queryString}`
        );

        if (append) {
          appendRuns(data.runs, data.total, data.has_more);
        } else {
          setRuns(data.runs, data.total, data.page, data.has_more);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch pipeline runs";
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [filters, buildQueryString, setRuns, appendRuns, setLoading, setError]
  );

  // Fetch stats
  const fetchStats = useCallback(
    async (pipelineName?: string, sinceHours = 24) => {
      setStatsLoading(true);

      try {
        const params = new URLSearchParams();
        if (pipelineName) params.set("pipeline_name", pipelineName);
        params.set("since_hours", String(sinceHours));

        const data = await apiClient.get<PipelineRunStats>(
          `/pipelines/runs/stats?${params.toString()}`
        );
        setStats(data);
      } catch (err) {
        // Stats are non-critical, just log
        console.error("Failed to fetch pipeline stats:", err);
      } finally {
        setStatsLoading(false);
      }
    },
    [setStats, setStatsLoading]
  );

  // Fetch a single run by ID
  const fetchRun = useCallback(
    async (runId: string): Promise<PipelineRun | null> => {
      try {
        const run = await apiClient.get<PipelineRun>(`/pipelines/runs/${runId}`);
        setSelectedRun(run);
        return run;
      } catch (err) {
        console.error("Failed to fetch pipeline run:", err);
        return null;
      }
    },
    [setSelectedRun]
  );

  // Update filters and refetch
  const updateFilters = useCallback(
    (newFilters: Partial<PipelineRunFilters>) => {
      setFilters(newFilters);
    },
    [setFilters]
  );

  // Load more (next page)
  const loadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      setPage(page + 1);
    }
  }, [isLoading, hasMore, page, setPage]);

  // Initial fetch when filters change
  useEffect(() => {
    fetchRuns();
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    // Data
    runs,
    total,
    page,
    pageSize,
    hasMore,
    isLoading,
    error,
    filters,
    stats,
    statsLoading,
    selectedRun,

    // Actions
    fetchRuns,
    fetchStats,
    fetchRun,
    updateFilters,
    resetFilters,
    loadMore,
    setSelectedRun,
    setPage,
    setPageSize,
  };
}


