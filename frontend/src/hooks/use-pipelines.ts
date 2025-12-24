"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { usePipelineStore } from "@/stores";
import { apiClient } from "@/lib/api-client";
import type {
  PipelineListResponse,
  PipelineExecuteResponse,
  PipelineFilters,
} from "@/types";

/**
 * Hook for managing pipelines - fetching, executing, and tracking state.
 */
export function usePipelines(filters?: PipelineFilters) {
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

  // Track if we've already fetched to prevent infinite loops
  const hasFetchedRef = useRef(false);

  // Fetch pipelines
  const fetchPipelines = useCallback(async (fetchFilters?: PipelineFilters) => {
    // Mark as fetched to prevent auto-fetch loop
    hasFetchedRef.current = true;
    setLoading(true);
    setError(null);

    try {
      // Build query params
      const params = new URLSearchParams();
      const activeFilters = fetchFilters || filters;
      
      if (activeFilters?.area) {
        params.set("area", activeFilters.area);
      }
      if (activeFilters?.tags && activeFilters.tags.length > 0) {
        params.set("tags", activeFilters.tags.join(","));
      }

      const queryString = params.toString();
      const url = queryString ? `/pipelines?${queryString}` : "/pipelines";
      
      const data = await apiClient.get<PipelineListResponse>(url);
      setPipelines(data.pipelines);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch pipelines";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [setPipelines, setLoading, setError, filters]);

  // Execute a pipeline
  const executePipeline = useCallback(
    async (pipelineName: string, input: Record<string, unknown>) => {
      startExecution(pipelineName, input);

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

  // Filter pipelines by area (client-side filtering for already-fetched pipelines)
  const filterByArea = useCallback((area: string) => {
    return pipelines.filter((p) => p.area === area);
  }, [pipelines]);

  // Filter pipelines by tags (client-side filtering for already-fetched pipelines)
  const filterByTags = useCallback((tags: string[]) => {
    return pipelines.filter((p) => 
      tags.every((tag) => p.tags.includes(tag))
    );
  }, [pipelines]);

  // Get unique areas from all pipelines
  const availableAreas = useMemo(() => {
    const areas = new Set<string>();
    pipelines.forEach((p) => {
      if (p.area) areas.add(p.area);
    });
    return Array.from(areas).sort();
  }, [pipelines]);

  // Get unique tags from all pipelines
  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    pipelines.forEach((p) => {
      p.tags.forEach((tag) => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [pipelines]);

  // Auto-fetch on mount (only once)
  useEffect(() => {
    // Only auto-fetch if we haven't fetched yet and there's no data
    if (!hasFetchedRef.current && pipelines.length === 0 && !isLoading) {
      fetchPipelines();
    }
  }, [pipelines.length, isLoading, fetchPipelines]);

  return {
    // Data
    pipelines,
    isLoading,
    error,
    executions,
    availableAreas,
    availableTags,

    // Actions
    fetchPipelines,
    executePipeline,
    resetExecution,
    getExecutionState,
    filterByArea,
    filterByTags,
  };
}

