"use client";

import { useCallback, useState } from "react";
import { apiClient } from "@/lib/api-client";
import type { JobProfile, JobProfileSummary, JobProfileCreate, JobProfileUpdate } from "@/types";

/**
 * Hook for managing job profiles.
 * Supports multiple profiles per user with CRUD operations.
 */
export function useJobProfiles() {
  const [profiles, setProfiles] = useState<JobProfileSummary[]>([]);
  const [currentProfile, setCurrentProfile] = useState<JobProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch all profiles for the current user.
   */
  const fetchProfiles = useCallback(async (): Promise<JobProfileSummary[]> => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await apiClient.get<JobProfileSummary[]>("/job-profiles");
      setProfiles(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch profiles");
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Get a specific profile by ID.
   */
  const getProfile = useCallback(async (id: string): Promise<JobProfile | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await apiClient.get<JobProfile>(`/job-profiles/${id}`);
      setCurrentProfile(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch profile");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Get the default profile.
   */
  const getDefaultProfile = useCallback(async (): Promise<JobProfile | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await apiClient.get<JobProfile | null>("/job-profiles/default");
      setCurrentProfile(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch default profile");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Create a new profile.
   */
  const createProfile = useCallback(
    async (data: JobProfileCreate): Promise<JobProfile | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const created = await apiClient.post<JobProfile>("/job-profiles", data);
        // Refresh profiles list
        await fetchProfiles();
        return created;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create profile");
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchProfiles]
  );

  /**
   * Update an existing profile.
   */
  const updateProfile = useCallback(
    async (id: string, data: JobProfileUpdate): Promise<JobProfile | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const updated = await apiClient.patch<JobProfile>(`/job-profiles/${id}`, data);
        // Update current profile if it's the one we updated
        if (currentProfile?.id === id) {
          setCurrentProfile(updated);
        }
        // Refresh profiles list
        await fetchProfiles();
        return updated;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update profile");
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [currentProfile, fetchProfiles]
  );

  /**
   * Delete a profile.
   */
  const deleteProfile = useCallback(
    async (id: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        await apiClient.delete(`/job-profiles/${id}`);
        // Clear current profile if it's the one we deleted
        if (currentProfile?.id === id) {
          setCurrentProfile(null);
        }
        // Refresh profiles list
        await fetchProfiles();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete profile");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [currentProfile, fetchProfiles]
  );

  /**
   * Set a profile as the default.
   */
  const setDefault = useCallback(
    async (id: string): Promise<JobProfile | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const updated = await apiClient.post<JobProfile>(`/job-profiles/${id}/set-default`);
        // Refresh profiles list to update default status
        await fetchProfiles();
        return updated;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to set default profile");
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchProfiles]
  );

  /**
   * Get the default profile from the loaded profiles.
   */
  const defaultProfile = profiles.find((p) => p.is_default) || null;

  /**
   * Check if user has any profiles.
   */
  const hasProfiles = profiles.length > 0;

  /**
   * Check if the current/default profile has a resume.
   */
  const hasCompleteProfile = defaultProfile?.has_resume ?? false;

  return {
    profiles,
    currentProfile,
    defaultProfile,
    isLoading,
    error,
    hasProfiles,
    hasCompleteProfile,
    fetchProfiles,
    getProfile,
    getDefaultProfile,
    createProfile,
    updateProfile,
    deleteProfile,
    setDefault,
    setCurrentProfile,
    setError,
  };
}
