"use client";

import { useCallback, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useResumeQuery, useResumesQuery } from "./queries/jobs";
import type { Resume, ResumeSummary } from "@/types";

export function useResumes() {
  const queryClient = useQueryClient();
  const [currentResumeId, setCurrentResumeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resumesQuery = useResumesQuery();
  const currentResumeQuery = useResumeQuery(currentResumeId);

  const invalidateResumes = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.jobs.resumes() });
  }, [queryClient]);

  const uploadMutation = useMutation({
    mutationFn: async ({
      file,
      name,
      setPrimaryFlag,
    }: {
      file: File;
      name: string;
      setPrimaryFlag: boolean;
    }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", name);
      formData.append("set_primary", setPrimaryFlag.toString());

      const response = await fetch("/api/resumes", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || "Failed to upload resume");
      }

      return (await response.json()) as Resume;
    },
    onSuccess: async () => {
      await invalidateResumes();
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : "Failed to upload resume");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string } }) =>
      apiClient.patch<Resume>(`/resumes/${id}`, data),
    onSuccess: async (updated) => {
      queryClient.setQueryData([...queryKeys.jobs.resumes(), updated.id], updated);
      await invalidateResumes();
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : "Failed to update resume");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/resumes/${id}`),
    onSuccess: async (_, id) => {
      if (currentResumeId === id) {
        setCurrentResumeId(null);
      }
      await invalidateResumes();
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : "Failed to delete resume");
    },
  });

  const setPrimaryMutation = useMutation({
    mutationFn: (id: string) => apiClient.post<Resume>(`/resumes/${id}/set-primary`),
    onSuccess: async () => {
      await invalidateResumes();
    },
    onError: (mutationError) => {
      setError(
        mutationError instanceof Error ? mutationError.message : "Failed to set primary resume"
      );
    },
  });

  const fetchResumes = useCallback(async (): Promise<ResumeSummary[]> => {
    setError(null);

    try {
      return await queryClient.fetchQuery({
        queryKey: queryKeys.jobs.resumes(),
        queryFn: () => apiClient.get<ResumeSummary[]>("/resumes"),
      });
    } catch (queryError) {
      const message = queryError instanceof Error ? queryError.message : "Failed to fetch resumes";
      setError(message);
      return [];
    }
  }, [queryClient]);

  const getResume = useCallback(
    async (id: string): Promise<Resume | null> => {
      setCurrentResumeId(id);
      setError(null);

      try {
        return await queryClient.fetchQuery({
          queryKey: [...queryKeys.jobs.resumes(), id],
          queryFn: () => apiClient.get<Resume>(`/resumes/${id}`),
        });
      } catch (queryError) {
        const message = queryError instanceof Error ? queryError.message : "Failed to fetch resume";
        setError(message);
        return null;
      }
    },
    [queryClient]
  );

  const resumes = resumesQuery.data ?? [];
  const currentResume = currentResumeQuery.data ?? null;
  const primaryResume = resumes.find((resume) => resume.is_primary) ?? null;

  return {
    resumes,
    currentResume,
    primaryResume,
    isLoading:
      resumesQuery.isLoading ||
      currentResumeQuery.isFetching ||
      uploadMutation.isPending ||
      updateMutation.isPending ||
      deleteMutation.isPending ||
      setPrimaryMutation.isPending,
    error:
      error ??
      (resumesQuery.error instanceof Error
        ? resumesQuery.error.message
        : currentResumeQuery.error instanceof Error
          ? currentResumeQuery.error.message
          : null),
    hasResumes: resumes.length > 0,
    hasCompleteResume: resumes.some((resume) => resume.has_text),
    fetchResumes,
    getResume,
    uploadResume: async (file: File, name: string, setPrimaryFlag = false) => {
      setError(null);
      try {
        return await uploadMutation.mutateAsync({ file, name, setPrimaryFlag });
      } catch {
        return null;
      }
    },
    updateResume: async (id: string, data: { name?: string }) => {
      setError(null);
      try {
        return await updateMutation.mutateAsync({ id, data });
      } catch {
        return null;
      }
    },
    deleteResume: async (id: string) => {
      setError(null);
      try {
        await deleteMutation.mutateAsync(id);
        return true;
      } catch {
        return false;
      }
    },
    setPrimary: async (id: string) => {
      setError(null);
      try {
        return await setPrimaryMutation.mutateAsync(id);
      } catch {
        return null;
      }
    },
    setCurrentResume: (resume: Resume | null) => setCurrentResumeId(resume?.id ?? null),
    setError,
  };
}
