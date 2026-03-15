"use client";

import { useCallback, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useProjectQuery, useProjectsQuery, useProjectTextQuery } from "./queries/jobs";
import type { Project, ProjectSummary, ProjectUpdate, ProjectTextResponse } from "@/types";

export function useProjects() {
  const queryClient = useQueryClient();
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [textProjectId, setTextProjectId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const projectsQuery = useProjectsQuery();
  const currentProjectQuery = useProjectQuery(currentProjectId);
  const projectTextQuery = useProjectTextQuery(textProjectId);

  const invalidateProjects = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.jobs.projects() });
  }, [queryClient]);

  const uploadMutation = useMutation({
    mutationFn: async ({ file, name }: { file: File; name: string }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", name);

      const response = await fetch("/api/projects", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || "Failed to upload project");
      }

      return (await response.json()) as Project;
    },
    onSuccess: async () => {
      await invalidateProjects();
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : "Failed to upload project");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProjectUpdate }) =>
      apiClient.patch<Project>(`/projects/${id}`, data),
    onSuccess: async (updated) => {
      queryClient.setQueryData([...queryKeys.jobs.projects(), updated.id], updated);
      await invalidateProjects();
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : "Failed to update project");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/projects/${id}`),
    onSuccess: async (_, id) => {
      if (currentProjectId === id) {
        setCurrentProjectId(null);
      }
      await invalidateProjects();
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : "Failed to delete project");
    },
  });

  const fetchProjects = useCallback(async (): Promise<ProjectSummary[]> => {
    setError(null);

    try {
      return await queryClient.fetchQuery({
        queryKey: queryKeys.jobs.projects(),
        queryFn: () => apiClient.get<ProjectSummary[]>("/projects"),
      });
    } catch (queryError) {
      const message = queryError instanceof Error ? queryError.message : "Failed to fetch projects";
      setError(message);
      return [];
    }
  }, [queryClient]);

  const getProject = useCallback(
    async (id: string): Promise<Project | null> => {
      setCurrentProjectId(id);
      setError(null);

      try {
        return await queryClient.fetchQuery({
          queryKey: [...queryKeys.jobs.projects(), id],
          queryFn: () => apiClient.get<Project>(`/projects/${id}`),
        });
      } catch (queryError) {
        const message =
          queryError instanceof Error ? queryError.message : "Failed to fetch project";
        setError(message);
        return null;
      }
    },
    [queryClient]
  );

  const getProjectText = useCallback(
    async (id: string): Promise<ProjectTextResponse | null> => {
      setTextProjectId(id);
      setError(null);

      try {
        return await queryClient.fetchQuery({
          queryKey: [...queryKeys.jobs.projects(), id, "text"],
          queryFn: () => apiClient.get<ProjectTextResponse>(`/projects/${id}/text`),
        });
      } catch (queryError) {
        const message =
          queryError instanceof Error ? queryError.message : "Failed to fetch project text";
        setError(message);
        return null;
      }
    },
    [queryClient]
  );

  const projects = projectsQuery.data ?? [];
  const currentProject = currentProjectQuery.data ?? null;

  return {
    projects,
    currentProject,
    isLoading:
      projectsQuery.isLoading ||
      currentProjectQuery.isFetching ||
      projectTextQuery.isFetching ||
      uploadMutation.isPending ||
      updateMutation.isPending ||
      deleteMutation.isPending,
    error:
      error ??
      (projectsQuery.error instanceof Error
        ? projectsQuery.error.message
        : currentProjectQuery.error instanceof Error
          ? currentProjectQuery.error.message
          : projectTextQuery.error instanceof Error
            ? projectTextQuery.error.message
            : null),
    hasProjects: projects.length > 0,
    fetchProjects,
    getProject,
    getProjectText,
    uploadProject: async (file: File, name: string) => {
      setError(null);
      try {
        return await uploadMutation.mutateAsync({ file, name });
      } catch {
        return null;
      }
    },
    updateProject: async (id: string, data: ProjectUpdate) => {
      setError(null);
      try {
        return await updateMutation.mutateAsync({ id, data });
      } catch {
        return null;
      }
    },
    deleteProject: async (id: string) => {
      setError(null);
      try {
        await deleteMutation.mutateAsync(id);
        return true;
      } catch {
        return false;
      }
    },
    setCurrentProject: (project: Project | null) => setCurrentProjectId(project?.id ?? null),
    setError,
  };
}
