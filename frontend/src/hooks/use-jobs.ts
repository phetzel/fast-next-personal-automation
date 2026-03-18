"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useJobQuery, useJobsListQuery, useJobStatsQuery } from "./queries/jobs";
import type { Job, JobFilters, JobListResponse, JobStats } from "@/types";
import { DEFAULT_JOB_STATUS_FILTERS } from "@/types";
import { toSearchParams } from "./queries/utils";
import { useJobMutations } from "./use-job-mutations";

const defaultFilters: JobFilters = {
  statuses: DEFAULT_JOB_STATUS_FILTERS,
  page: 1,
  page_size: 20,
  sort_by: "created_at",
  sort_order: "desc",
};

interface UseJobsOptions {
  initialFilters?: Partial<JobFilters>;
}

export function useJobs(options?: UseJobsOptions) {
  const queryClient = useQueryClient();
  const initialFilters = useMemo(
    () => ({ ...defaultFilters, ...options?.initialFilters }),
    [options?.initialFilters]
  );
  const [filters, setFiltersState] = useState<JobFilters>(initialFilters);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const filtersRef = useRef<JobFilters>(initialFilters);

  filtersRef.current = filters;

  const jobsQuery = useJobsListQuery(filters);
  const statsQuery = useJobStatsQuery();
  const selectedJobQuery = useJobQuery(selectedJobId);

  const mutations = useJobMutations({
    onJobCreated: (created) => setSelectedJobId(created.id),
    onJobDeleted: (jobId) => {
      if (selectedJobId === jobId) {
        setSelectedJobId(null);
      }
    },
  });

  const fetchJobs = useCallback(
    async (customFilters?: Partial<JobFilters>) => {
      const nextFilters = { ...filtersRef.current, ...customFilters };
      const queryString = toSearchParams(nextFilters);
      setFiltersState(nextFilters);
      setQueryError(null);

      try {
        const response = await queryClient.fetchQuery({
          queryKey: queryKeys.jobs.list(nextFilters),
          queryFn: () =>
            apiClient.get<JobListResponse>(queryString ? `/jobs?${queryString}` : "/jobs"),
        });
        return response.jobs;
      } catch (queryError) {
        const message = queryError instanceof Error ? queryError.message : "Failed to fetch jobs";
        setQueryError(message);
        return [];
      }
    },
    [queryClient]
  );

  const fetchStats = useCallback(async () => {
    setQueryError(null);

    try {
      return await queryClient.fetchQuery({
        queryKey: queryKeys.jobs.stats(),
        queryFn: () => apiClient.get<JobStats>("/jobs/stats"),
      });
    } catch {
      return null;
    }
  }, [queryClient]);

  const fetchJob = useCallback(
    async (jobId: string): Promise<Job | null> => {
      setSelectedJobId(jobId);
      setQueryError(null);

      try {
        return await queryClient.fetchQuery({
          queryKey: queryKeys.jobs.detail(jobId),
          queryFn: () => apiClient.get<Job>(`/jobs/${jobId}`),
        });
      } catch {
        return null;
      }
    },
    [queryClient]
  );

  const jobs = jobsQuery.data?.jobs ?? [];
  const total = jobsQuery.data?.total ?? 0;
  const selectedJob = selectedJobQuery.data ?? null;
  const setFilters = useCallback((newFilters: Partial<JobFilters>) => {
    setFiltersState((currentFilters) => ({ ...currentFilters, ...newFilters }));
  }, []);
  const resetFilters = useCallback(() => {
    setFiltersState(initialFilters);
  }, [initialFilters]);
  const setSelectedJob = useCallback((job: Job | null) => {
    setSelectedJobId(job?.id ?? null);
  }, []);
  const goToPage = useCallback((page: number) => {
    setFiltersState((currentFilters) => ({ ...currentFilters, page }));
  }, []);

  return {
    jobs,
    total,
    isLoading: jobsQuery.isLoading || jobsQuery.isFetching || mutations.isMutating,
    error:
      queryError ??
      mutations.error ??
      (jobsQuery.error instanceof Error
        ? jobsQuery.error.message
        : selectedJobQuery.error instanceof Error
          ? selectedJobQuery.error.message
          : null),
    filters,
    stats: statsQuery.data ?? null,
    statsLoading: statsQuery.isLoading || statsQuery.isFetching,
    selectedJob,
    hasMore: jobsQuery.data?.has_more ?? (filters.page || 1) * (filters.page_size || 20) < total,
    fetchJobs,
    fetchStats,
    fetchJob,
    updateJobStatus: mutations.updateJobStatus,
    deleteJob: mutations.deleteJob,
    setFilters,
    resetFilters,
    setSelectedJob,
    goToPage,
  };
}
