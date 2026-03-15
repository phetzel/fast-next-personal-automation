"use client";

import { useCallback, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useJobQuery, useJobsListQuery, useJobStatsQuery } from "./queries/jobs";
import type {
  Job,
  JobFilters,
  JobListResponse,
  JobStats,
  JobStatus,
  JobUpdate,
  ManualJobCreateRequest,
} from "@/types";
import { toSearchParams } from "./queries/utils";

const defaultFilters: JobFilters = {
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
  const initialFilters = { ...defaultFilters, ...options?.initialFilters };
  const [filters, setFiltersState] = useState<JobFilters>(initialFilters);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const filtersRef = useRef<JobFilters>(initialFilters);

  filtersRef.current = filters;

  const jobsQuery = useJobsListQuery(filters);
  const statsQuery = useJobStatsQuery();
  const selectedJobQuery = useJobQuery(selectedJobId);

  const createMutation = useMutation({
    mutationFn: (payload: ManualJobCreateRequest) => apiClient.post<Job>("/jobs", payload),
    onSuccess: async (created) => {
      setSelectedJobId(created.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.jobs.stats() }),
      ]);
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : "Failed to create job");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ jobId, update }: { jobId: string; update: JobUpdate }) =>
      apiClient.patch<Job>(`/jobs/${jobId}`, update),
    onSuccess: async (updated) => {
      queryClient.setQueryData(queryKeys.jobs.detail(updated.id), updated);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.jobs.stats() }),
      ]);
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : "Failed to update job");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (jobId: string) => apiClient.delete(`/jobs/${jobId}`),
    onSuccess: async (_, jobId) => {
      if (selectedJobId === jobId) {
        setSelectedJobId(null);
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.jobs.stats() }),
      ]);
    },
    onError: () => {
      setError("Failed to delete job");
    },
  });

  const deleteByStatusMutation = useMutation({
    mutationFn: (status: JobStatus) =>
      apiClient.post<{ deleted_count: number; status: string }>("/jobs/batch/delete", { status }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.jobs.stats() }),
      ]);
    },
    onError: () => {
      setError("Failed to delete jobs");
    },
  });

  const fetchJobs = useCallback(
    async (customFilters?: Partial<JobFilters>) => {
      const nextFilters = { ...filtersRef.current, ...customFilters };
      const queryString = toSearchParams(nextFilters);
      setFiltersState(nextFilters);
      setError(null);

      try {
        const response = await queryClient.fetchQuery({
          queryKey: queryKeys.jobs.list(nextFilters),
          queryFn: () =>
            apiClient.get<JobListResponse>(queryString ? `/jobs?${queryString}` : "/jobs"),
        });
        return response.jobs;
      } catch (queryError) {
        const message = queryError instanceof Error ? queryError.message : "Failed to fetch jobs";
        setError(message);
        return [];
      }
    },
    [queryClient]
  );

  const fetchStats = useCallback(async () => {
    setError(null);

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
      setError(null);

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

  return {
    jobs,
    total,
    isLoading:
      jobsQuery.isLoading ||
      jobsQuery.isFetching ||
      createMutation.isPending ||
      updateMutation.isPending ||
      deleteMutation.isPending,
    error:
      error ??
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
    createJob: async (payload: ManualJobCreateRequest) => {
      setError(null);
      try {
        return await createMutation.mutateAsync(payload);
      } catch {
        return null;
      }
    },
    updateJobStatus: async (jobId: string, update: JobUpdate) => {
      setError(null);
      try {
        return await updateMutation.mutateAsync({ jobId, update });
      } catch {
        return null;
      }
    },
    deleteJob: async (jobId: string) => {
      setError(null);
      try {
        await deleteMutation.mutateAsync(jobId);
        return true;
      } catch {
        return false;
      }
    },
    deleteByStatus: async (status: JobStatus) => {
      setError(null);
      const response = await deleteByStatusMutation.mutateAsync(status);
      return response.deleted_count;
    },
    setFilters: (newFilters: Partial<JobFilters>) =>
      setFiltersState((currentFilters) => ({ ...currentFilters, ...newFilters })),
    resetFilters: () => setFiltersState(initialFilters),
    setSelectedJob: (job: Job | null) => setSelectedJobId(job?.id ?? null),
    goToPage: (page: number) => setFiltersState((currentFilters) => ({ ...currentFilters, page })),
  };
}
