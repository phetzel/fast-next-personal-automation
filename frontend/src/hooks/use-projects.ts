"use client";

import { useCallback, useState } from "react";
import { apiClient } from "@/lib/api-client";
import type { Project, ProjectSummary, ProjectUpdate, ProjectTextResponse } from "@/types";

/**
 * Hook for managing projects.
 * Supports upload, list, update, delete, and toggle active operations.
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
      name: string,
      isActive: boolean = true
    ): Promise<Project | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("name", name);
        formData.append("is_active", isActive.toString());

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
   * Update a project's name or active status.
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
   * Toggle a project's active status.
   */
  const toggleActive = useCallback(
    async (id: string, isActive: boolean): Promise<Project | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const updated = await apiClient.post<Project>(
          `/projects/${id}/toggle-active?is_active=${isActive}`
        );
        // Refresh projects list to update active status
        await fetchProjects();
        return updated;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to toggle project active status");
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchProjects]
  );

  /**
   * Get all active projects from the loaded projects.
   */
  const activeProjects = projects.filter((p) => p.is_active);

  /**
   * Check if user has any projects.
   */
  const hasProjects = projects.length > 0;

  /**
   * Check if user has any active projects.
   */
  const hasActiveProjects = activeProjects.length > 0;

  return {
    projects,
    currentProject,
    activeProjects,
    isLoading,
    error,
    hasProjects,
    hasActiveProjects,
    fetchProjects,
    getProject,
    getProjectText,
    uploadProject,
    updateProject,
    deleteProject,
    toggleActive,
    setCurrentProject,
    setError,
  };
}

