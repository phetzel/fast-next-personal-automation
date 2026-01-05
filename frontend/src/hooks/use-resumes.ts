"use client";

import { useCallback, useState } from "react";
import { usePrimaryCrud } from "./use-crud";
import type { Resume, ResumeSummary } from "@/types";

/**
 * Hook for managing resumes.
 * Supports upload, list, delete, and set primary operations.
 *
 * Built on usePrimaryCrud factory with additional file upload support.
 */
export function useResumes() {
  const crud = usePrimaryCrud<Resume, ResumeSummary, never, { name?: string }>({
    endpoint: "/resumes",
    entityName: "resume",
  });

  const [uploadLoading, setUploadLoading] = useState(false);

  /**
   * Upload a new resume file.
   */
  const uploadResume = useCallback(
    async (file: File, name: string, setPrimaryFlag: boolean = false): Promise<Resume | null> => {
      setUploadLoading(true);
      crud.setError(null);

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("name", name);
        formData.append("set_primary", setPrimaryFlag.toString());

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
        await crud.fetchAll();
        return created;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to upload resume";
        crud.setError(message);
        return null;
      } finally {
        setUploadLoading(false);
      }
    },
    [crud]
  );

  /**
   * Check if user has a resume with extracted text.
   */
  const hasCompleteResume = crud.items.some((r) => r.has_text);

  return {
    // State
    resumes: crud.items,
    currentResume: crud.currentItem,
    primaryResume: crud.primaryItem,
    isLoading: crud.isLoading || uploadLoading,
    error: crud.error,
    hasResumes: crud.hasItems,
    hasCompleteResume,

    // Actions
    fetchResumes: crud.fetchAll,
    getResume: crud.fetchOne,
    uploadResume,
    updateResume: (id: string, data: { name?: string }) => crud.update(id, data),
    deleteResume: crud.remove,
    setPrimary: crud.setPrimary,
    setCurrentResume: crud.setCurrentItem,
    setError: crud.setError,
  };
}
