"use client";

import { useCallback, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useDefaultJobProfileQuery, useJobProfileQuery, useJobProfilesQuery } from "./queries/jobs";
import type { JobProfile, JobProfileSummary, JobProfileCreate, JobProfileUpdate } from "@/types";

export function useJobProfiles() {
  const queryClient = useQueryClient();
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const currentProfileIdRef = useRef<string | null>(null);

  currentProfileIdRef.current = currentProfileId;

  const profilesQuery = useJobProfilesQuery();
  const currentProfileQuery = useJobProfileQuery(currentProfileId);
  const defaultProfileQuery = useDefaultJobProfileQuery();

  const invalidateProfiles = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.jobs.profiles() });
  }, [queryClient]);

  const createMutation = useMutation({
    mutationFn: (data: JobProfileCreate) => apiClient.post<JobProfile>("/job-profiles", data),
    onSuccess: async () => {
      await invalidateProfiles();
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : "Failed to create profile");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: JobProfileUpdate }) =>
      apiClient.patch<JobProfile>(`/job-profiles/${id}`, data),
    onSuccess: async (updated) => {
      queryClient.setQueryData(queryKeys.jobs.profile(updated.id), updated);
      await invalidateProfiles();
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : "Failed to update profile");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/job-profiles/${id}`),
    onSuccess: async (_, id) => {
      if (currentProfileIdRef.current === id) {
        setCurrentProfileId(null);
      }
      await invalidateProfiles();
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : "Failed to delete profile");
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => apiClient.post<JobProfile>(`/job-profiles/${id}/set-default`),
    onSuccess: async (updated) => {
      queryClient.setQueryData(queryKeys.jobs.profile(updated.id), updated);
      await invalidateProfiles();
    },
    onError: (mutationError) => {
      setError(
        mutationError instanceof Error ? mutationError.message : "Failed to set default profile"
      );
    },
  });

  const fetchProfiles = useCallback(async (): Promise<JobProfileSummary[]> => {
    setError(null);

    try {
      return await queryClient.fetchQuery({
        queryKey: queryKeys.jobs.profiles(),
        queryFn: () => apiClient.get<JobProfileSummary[]>("/job-profiles"),
      });
    } catch (queryError) {
      const message = queryError instanceof Error ? queryError.message : "Failed to fetch profiles";
      setError(message);
      return [];
    }
  }, [queryClient]);

  const getProfile = useCallback(
    async (id: string): Promise<JobProfile | null> => {
      setCurrentProfileId(id);
      setError(null);

      try {
        return await queryClient.fetchQuery({
          queryKey: queryKeys.jobs.profile(id),
          queryFn: () => apiClient.get<JobProfile>(`/job-profiles/${id}`),
        });
      } catch (queryError) {
        const message =
          queryError instanceof Error ? queryError.message : "Failed to fetch profile";
        setError(message);
        return null;
      }
    },
    [queryClient]
  );

  const getDefaultProfile = useCallback(async (): Promise<JobProfile | null> => {
    setError(null);

    try {
      return await queryClient.fetchQuery({
        queryKey: [...queryKeys.jobs.profiles(), "default"],
        queryFn: () => apiClient.get<JobProfile | null>("/job-profiles/default"),
      });
    } catch (queryError) {
      const message =
        queryError instanceof Error ? queryError.message : "Failed to fetch default profile";
      setError(message);
      return null;
    }
  }, [queryClient]);

  const profiles = profilesQuery.data ?? [];
  const currentProfile = currentProfileQuery.data ?? null;
  const defaultProfile =
    (profiles.find((profile) => profile.is_default) as JobProfileSummary | null | undefined) ??
    defaultProfileQuery.data ??
    null;

  return {
    profiles,
    currentProfile,
    defaultProfile,
    isLoading:
      profilesQuery.isLoading ||
      currentProfileQuery.isFetching ||
      defaultProfileQuery.isFetching ||
      createMutation.isPending ||
      updateMutation.isPending ||
      deleteMutation.isPending ||
      setDefaultMutation.isPending,
    error:
      error ??
      (profilesQuery.error instanceof Error
        ? profilesQuery.error.message
        : currentProfileQuery.error instanceof Error
          ? currentProfileQuery.error.message
          : defaultProfileQuery.error instanceof Error
            ? defaultProfileQuery.error.message
            : null),
    hasProfiles: profiles.length > 0,
    hasCompleteProfile: Boolean(
      defaultProfile && "has_resume" in defaultProfile ? defaultProfile.has_resume : false
    ),
    fetchProfiles,
    getProfile,
    getDefaultProfile,
    createProfile: async (data: JobProfileCreate) => {
      setError(null);
      try {
        return await createMutation.mutateAsync(data);
      } catch {
        return null;
      }
    },
    updateProfile: async (id: string, data: JobProfileUpdate) => {
      setError(null);
      try {
        return await updateMutation.mutateAsync({ id, data });
      } catch {
        return null;
      }
    },
    deleteProfile: async (id: string) => {
      setError(null);
      try {
        await deleteMutation.mutateAsync(id);
        return true;
      } catch {
        return false;
      }
    },
    setDefault: async (id: string) => {
      setError(null);
      try {
        return await setDefaultMutation.mutateAsync(id);
      } catch {
        return null;
      }
    },
    setCurrentProfile: (profile: JobProfile | null) => setCurrentProfileId(profile?.id ?? null),
    setError,
  };
}
