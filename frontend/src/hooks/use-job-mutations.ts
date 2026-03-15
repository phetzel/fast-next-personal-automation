"use client";

import { useCallback, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type {
  Job,
  JobStatus,
  JobUpdate,
  ManualAnalyzeRequest,
  ManualJobCreateRequest,
} from "@/types";

interface UseJobMutationsOptions {
  onJobCreated?: (job: Job) => void;
  onJobUpdated?: (job: Job) => void;
  onJobDeleted?: (jobId: string) => void;
}

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function useJobMutations(options: UseJobMutationsOptions = {}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const invalidateJobs = useCallback(
    async (jobId?: string) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.jobs.stats() }),
        jobId
          ? queryClient.invalidateQueries({ queryKey: queryKeys.jobs.detail(jobId) })
          : Promise.resolve(),
      ]);
    },
    [queryClient]
  );

  const createMutation = useMutation({
    mutationFn: (payload: ManualJobCreateRequest) => apiClient.post<Job>("/jobs", payload),
    onSuccess: async (created) => {
      queryClient.setQueryData(queryKeys.jobs.detail(created.id), created);
      options.onJobCreated?.(created);
      await invalidateJobs(created.id);
    },
    onError: (mutationError) => {
      setError(toErrorMessage(mutationError, "Failed to create job"));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ jobId, update }: { jobId: string; update: JobUpdate }) =>
      apiClient.patch<Job>(`/jobs/${jobId}`, update),
    onSuccess: async (updated) => {
      queryClient.setQueryData(queryKeys.jobs.detail(updated.id), updated);
      options.onJobUpdated?.(updated);
      await invalidateJobs(updated.id);
    },
    onError: (mutationError) => {
      setError(toErrorMessage(mutationError, "Failed to update job"));
    },
  });

  const manualAnalyzeMutation = useMutation({
    mutationFn: ({ jobId, payload }: { jobId: string; payload: ManualAnalyzeRequest }) =>
      apiClient.post<Job>(`/jobs/${jobId}/manual-analyze`, payload),
    onSuccess: async (updated) => {
      queryClient.setQueryData(queryKeys.jobs.detail(updated.id), updated);
      options.onJobUpdated?.(updated);
      await invalidateJobs(updated.id);
    },
    onError: (mutationError) => {
      setError(toErrorMessage(mutationError, "Failed to analyze job"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (jobId: string) => apiClient.delete(`/jobs/${jobId}`),
    onSuccess: async (_, jobId) => {
      queryClient.removeQueries({ queryKey: queryKeys.jobs.detail(jobId) });
      options.onJobDeleted?.(jobId);
      await invalidateJobs();
    },
    onError: (mutationError) => {
      setError(toErrorMessage(mutationError, "Failed to delete job"));
    },
  });

  const deleteByStatusMutation = useMutation({
    mutationFn: (status: JobStatus) =>
      apiClient.post<{ deleted_count: number; status: string }>("/jobs/batch/delete", { status }),
    onSuccess: async () => {
      await invalidateJobs();
    },
    onError: (mutationError) => {
      setError(toErrorMessage(mutationError, "Failed to delete jobs"));
    },
  });

  return {
    error,
    clearError: () => setError(null),
    isMutating:
      createMutation.isPending ||
      updateMutation.isPending ||
      manualAnalyzeMutation.isPending ||
      deleteMutation.isPending ||
      deleteByStatusMutation.isPending,
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
    manualAnalyzeJob: async (jobId: string, payload: ManualAnalyzeRequest) => {
      setError(null);
      try {
        return await manualAnalyzeMutation.mutateAsync({ jobId, payload });
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
  };
}
