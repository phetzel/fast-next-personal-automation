"use client";

import { useCallback, useState } from "react";
import { apiClient } from "@/lib/api-client";
import type { Project, ProjectSummary, ProjectUpdate, ProjectTextResponse } from "@/types";

/**
 * Hook for managing projects.
 * Projects are linked to profiles rather than having their own active status.
 */
export function useProjects() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch all projects for the current user.
   */
  const fetchProjects = useCallback(async (): Promise<ProjectSummary[]> => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await apiClient.get<ProjectSummary[]>("/projects");
      setProjects(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch projects");
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Get a specific project by ID.
   */
  const getProject = useCallback(async (id: string): Promise<Project | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await apiClient.get<Project>(`/projects/${id}`);
      setCurrentProject(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch project");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Get project text content.
   */
  const getProjectText = useCallback(async (id: string): Promise<ProjectTextResponse | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await apiClient.get<ProjectTextResponse>(`/projects/${id}/text`);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch project text");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Upload a new project file.
   */
  const uploadProject = useCallback(
    async (
      file: File,
      name: string
    ): Promise<Project | null> => {
      setIsLoading(true);
      setError(null);

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
        await fetchProjects();
        return created;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to upload project");
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchProjects]
  );

  /**
   * Update a project's name.
   */
  const updateProject = useCallback(
    async (id: string, data: ProjectUpdate): Promise<Project | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const updated = await apiClient.patch<Project>(`/projects/${id}`, data);
        // Refresh projects list
        await fetchProjects();
        return updated;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update project");
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchProjects]
  );

  /**
   * Delete a project.
   */
  const deleteProject = useCallback(
    async (id: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        await apiClient.delete(`/projects/${id}`);
        // Clear current project if it's the one we deleted
        if (currentProject?.id === id) {
          setCurrentProject(null);
        }
        // Refresh projects list
        await fetchProjects();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete project");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [currentProject, fetchProjects]
  );

  /**
   * Check if user has any projects.
   */
  const hasProjects = projects.length > 0;

  return {
    projects,
    currentProject,
    isLoading,
    error,
    hasProjects,
    fetchProjects,
    getProject,
    getProjectText,
    uploadProject,
    updateProject,
    deleteProject,
    setCurrentProject,
    setError,
  };
}

