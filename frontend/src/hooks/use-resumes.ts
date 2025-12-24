"use client";

import { useCallback, useState } from "react";
import { apiClient } from "@/lib/api-client";
import type { Resume, ResumeSummary } from "@/types";

/**
 * Hook for managing resumes.
 * Supports upload, list, delete, and set primary operations.
 */
export function useResumes() {
  const [resumes, setResumes] = useState<ResumeSummary[]>([]);
  const [currentResume, setCurrentResume] = useState<Resume | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch all resumes for the current user.
   */
  const fetchResumes = useCallback(async (): Promise<ResumeSummary[]> => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await apiClient.get<ResumeSummary[]>("/resumes");
      setResumes(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch resumes");
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Get a specific resume by ID.
   */
  const getResume = useCallback(async (id: string): Promise<Resume | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await apiClient.get<Resume>(`/resumes/${id}`);
      setCurrentResume(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch resume");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Upload a new resume file.
   */
  const uploadResume = useCallback(
    async (
      file: File,
      name: string,
      setPrimary: boolean = false
    ): Promise<Resume | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("name", name);
        formData.append("set_primary", setPrimary.toString());

        // Use fetch directly for FormData upload
        const response = await fetch("/api/resumes", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(errorData?.detail || "Failed to upload resume");
        }

        const created = await response.json();
        // Refresh resumes list
        await fetchResumes();
        return created;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to upload resume");
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchResumes]
  );

  /**
   * Delete a resume.
   */
  const deleteResume = useCallback(
    async (id: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        await apiClient.delete(`/resumes/${id}`);
        // Clear current resume if it's the one we deleted
        if (currentResume?.id === id) {
          setCurrentResume(null);
        }
        // Refresh resumes list
        await fetchResumes();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete resume");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [currentResume, fetchResumes]
  );

  /**
   * Set a resume as primary.
   */
  const setPrimary = useCallback(
    async (id: string): Promise<Resume | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const updated = await apiClient.post<Resume>(`/resumes/${id}/set-primary`);
        // Refresh resumes list to update primary status
        await fetchResumes();
        return updated;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to set primary resume");
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchResumes]
  );

  /**
   * Update a resume's name.
   */
  const updateResume = useCallback(
    async (id: string, data: { name?: string }): Promise<Resume | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const updated = await apiClient.patch<Resume>(`/resumes/${id}`, data);
        // Refresh resumes list
        await fetchResumes();
        return updated;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update resume");
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchResumes]
  );

  /**
   * Get the primary resume from the loaded resumes.
   */
  const primaryResume = resumes.find((r) => r.is_primary) || null;

  /**
   * Check if user has any resumes.
   */
  const hasResumes = resumes.length > 0;

  /**
   * Check if user has a resume with extracted text.
   */
  const hasCompleteResume = resumes.some((r) => r.has_text);

  return {
    resumes,
    currentResume,
    primaryResume,
    isLoading,
    error,
    hasResumes,
    hasCompleteResume,
    fetchResumes,
    getResume,
    uploadResume,
    deleteResume,
    setPrimary,
    updateResume,
    setCurrentResume,
    setError,
  };
}


