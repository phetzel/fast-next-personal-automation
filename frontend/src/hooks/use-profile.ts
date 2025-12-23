"use client";

import { useCallback, useState } from "react";
import { apiClient } from "@/lib/api-client";
import type { UserProfile, UserProfileCreate, UserProfileUpdate } from "@/types";

/**
 * Hook for managing user profile data.
 */
export function useProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch the current user's profile.
   */
  const fetchProfile = useCallback(async (): Promise<UserProfile | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await apiClient.get<UserProfile | null>("/api/profile");
      setProfile(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch profile");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Create or update the user's profile (full replacement).
   */
  const saveProfile = useCallback(
    async (data: UserProfileCreate): Promise<UserProfile | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const updated = await apiClient.put<UserProfile>("/api/profile", data);
        setProfile(updated);
        return updated;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save profile");
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Partially update the user's profile.
   */
  const updateProfile = useCallback(
    async (data: UserProfileUpdate): Promise<UserProfile | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const updated = await apiClient.patch<UserProfile>("/api/profile", data);
        setProfile(updated);
        return updated;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update profile");
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Delete the user's profile.
   */
  const deleteProfile = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      await apiClient.delete("/api/profile");
      setProfile(null);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete profile");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Check if the user has a complete profile (with resume).
   */
  const hasCompleteProfile =
    profile !== null && profile.resume_text !== null && profile.resume_text.trim() !== "";

  return {
    profile,
    isLoading,
    error,
    hasCompleteProfile,
    fetchProfile,
    saveProfile,
    updateProfile,
    deleteProfile,
    setProfile,
    setError,
  };
}

