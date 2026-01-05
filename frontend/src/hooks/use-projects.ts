"use client";

import { useCallback, useState } from "react";
import { useCrud } from "./use-crud";
import { apiClient } from "@/lib/api-client";
import type { Project, ProjectSummary, ProjectUpdate, ProjectTextResponse } from "@/types";

/**
 * Hook for managing projects.
 * Projects are linked to profiles rather than having their own active status.
 *
 * Built on useCrud factory with additional file upload support.
 */
export function useProjects() {
  const crud = useCrud<Project, ProjectSummary, never, ProjectUpdate>({
    endpoint: "/projects",
    entityName: "project",
  });

  const [uploadLoading, setUploadLoading] = useState(false);
  const [textLoading, setTextLoading] = useState(false);

  /**
   * Get project text content.
   */
  const getProjectText = useCallback(
    async (id: string): Promise<ProjectTextResponse | null> => {
      setTextLoading(true);
      crud.setError(null);

      try {
        const data = await apiClient.get<ProjectTextResponse>(`/projects/${id}/text`);
        return data;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch project text";
        crud.setError(message);
        return null;
      } finally {
        setTextLoading(false);
      }
    },
    [crud]
  );

  /**
   * Upload a new project file.
   */
  const uploadProject = useCallback(
    async (file: File, name: string): Promise<Project | null> => {
      setUploadLoading(true);
      crud.setError(null);

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("name", name);

        // Use fetch directly for FormData upload
        const response = await fetch("/api/projects", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(errorData?.detail || "Failed to upload project");
        }

        const created = await response.json();
        // Refresh projects list
        await crud.fetchAll();
        return created;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to upload project";
        crud.setError(message);
        return null;
      } finally {
        setUploadLoading(false);
      }
    },
    [crud]
  );

  return {
    // State
    projects: crud.items,
    currentProject: crud.currentItem,
    isLoading: crud.isLoading || uploadLoading || textLoading,
    error: crud.error,
    hasProjects: crud.items.length > 0,

    // Actions
    fetchProjects: crud.fetchAll,
    getProject: crud.fetchOne,
    getProjectText,
    uploadProject,
    updateProject: (id: string, data: ProjectUpdate) => crud.update(id, data),
    deleteProject: crud.remove,
    setCurrentProject: crud.setCurrentItem,
    setError: crud.setError,
  };
}
