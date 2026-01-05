"use client";

import { useCallback } from "react";
import { useJobStore } from "@/stores/job-store";
import { apiClient } from "@/lib/api-client";
import type { Job, JobFilters, JobListResponse, JobStats, JobStatus, JobUpdate } from "@/types";

/**
 * Hook for managing jobs data and API interactions.
 */
export function useJobs() {
  const {
    jobs,
    total,
    isLoading,
    error,
    filters,
    stats,
    statsLoading,
    selectedJob,
    setJobs,
    setLoading,
    setError,
    setFilters,
    resetFilters,
    setStats,
    setStatsLoading,
    setSelectedJob,
    updateJob,
    removeJob,
  } = useJobStore();

  /**
   * Fetch jobs with current filters.
   */
  const fetchJobs = useCallback(
    async (customFilters?: Partial<JobFilters>) => {
      setLoading(true);
      setError(null);

      try {
        const appliedFilters = { ...filters, ...customFilters };
        const params = new URLSearchParams();

        if (appliedFilters.status) params.set("status", appliedFilters.status);
        if (appliedFilters.source) params.set("source", appliedFilters.source);
        if (appliedFilters.ingestion_source)
          params.set("ingestion_source", appliedFilters.ingestion_source);
        if (appliedFilters.min_score !== undefined)
          params.set("min_score", String(appliedFilters.min_score));
        if (appliedFilters.max_score !== undefined)
          params.set("max_score", String(appliedFilters.max_score));
        if (appliedFilters.search) params.set("search", appliedFilters.search);
        if (appliedFilters.posted_within_hours !== undefined)
          params.set("posted_within_hours", String(appliedFilters.posted_within_hours));
        if (appliedFilters.page) params.set("page", String(appliedFilters.page));
        if (appliedFilters.page_size) params.set("page_size", String(appliedFilters.page_size));
        if (appliedFilters.sort_by) params.set("sort_by", appliedFilters.sort_by);
        if (appliedFilters.sort_order) params.set("sort_order", appliedFilters.sort_order);

        const response = await apiClient.get<JobListResponse>(`/jobs?${params.toString()}`);

        setJobs(response.jobs, response.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch jobs");
      } finally {
        setLoading(false);
      }
    },
    [filters, setJobs, setLoading, setError]
  );

  /**
   * Fetch job statistics.
   */
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);

    try {
      const response = await apiClient.get<JobStats>("/jobs/stats");
      setStats(response);
    } catch {
      // Stats are optional, don't show error
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, [setStats, setStatsLoading]);

  /**
   * Fetch a single job by ID.
   */
  const fetchJob = useCallback(
    async (jobId: string): Promise<Job | null> => {
      try {
        const job = await apiClient.get<Job>(`/jobs/${jobId}`);
        setSelectedJob(job);
        return job;
      } catch {
        return null;
      }
    },
    [setSelectedJob]
  );

  /**
   * Update a job's status or notes.
   */
  const updateJobStatus = useCallback(
    async (jobId: string, update: JobUpdate): Promise<Job | null> => {
      try {
        const job = await apiClient.patch<Job>(`/jobs/${jobId}`, update);
        updateJob(job);
        return job;
      } catch {
        setError("Failed to update job");
        return null;
      }
    },
    [updateJob, setError]
  );

  /**
   * Delete a job.
   */
  const deleteJob = useCallback(
    async (jobId: string): Promise<boolean> => {
      try {
        await apiClient.delete(`/jobs/${jobId}`);
        removeJob(jobId);
        return true;
      } catch {
        setError("Failed to delete job");
        return false;
      }
    },
    [removeJob, setError]
  );

  /**
   * Delete all jobs with a specific status (soft delete).
   */
  const deleteByStatus = useCallback(async (status: JobStatus): Promise<number> => {
    const response = await apiClient.post<{ deleted_count: number; status: string }>(
      "/jobs/batch/delete",
      { status }
    );
    return response.deleted_count;
  }, []);

  /**
   * Change page.
   */
  const goToPage = useCallback(
    (page: number) => {
      setFilters({ page });
    },
    [setFilters]
  );

  /**
   * Check if there are more pages.
   */
  const hasMore = (filters.page || 1) * (filters.page_size || 20) < total;

  return {
    // State
    jobs,
    total,
    isLoading,
    error,
    filters,
    stats,
    statsLoading,
    selectedJob,
    hasMore,

    // Actions
    fetchJobs,
    fetchStats,
    fetchJob,
    updateJobStatus,
    deleteJob,
    deleteByStatus,
    setFilters,
    resetFilters,
    setSelectedJob,
    goToPage,
  };
}
