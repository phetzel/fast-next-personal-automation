"use client";

import { useCallback, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useStoriesQuery, useStoryQuery } from "./queries/jobs";
import type { Story, StorySummary, StoryCreate, StoryUpdate } from "@/types";

export function useStories() {
  const queryClient = useQueryClient();
  const [currentStoryId, setCurrentStoryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const storiesQuery = useStoriesQuery();
  const currentStoryQuery = useStoryQuery(currentStoryId);

  const invalidateStories = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.jobs.stories() });
  }, [queryClient]);

  const createMutation = useMutation({
    mutationFn: (data: StoryCreate) => apiClient.post<Story>("/stories", data),
    onSuccess: async () => {
      await invalidateStories();
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : "Failed to create story");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: StoryUpdate }) =>
      apiClient.patch<Story>(`/stories/${id}`, data),
    onSuccess: async (updated) => {
      queryClient.setQueryData([...queryKeys.jobs.stories(), updated.id], updated);
      await invalidateStories();
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : "Failed to update story");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/stories/${id}`),
    onSuccess: async (_, id) => {
      if (currentStoryId === id) {
        setCurrentStoryId(null);
      }
      await invalidateStories();
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : "Failed to delete story");
    },
  });

  const setPrimaryMutation = useMutation({
    mutationFn: (id: string) => apiClient.post<Story>(`/stories/${id}/set-primary`),
    onSuccess: async () => {
      await invalidateStories();
    },
    onError: (mutationError) => {
      setError(
        mutationError instanceof Error ? mutationError.message : "Failed to set primary story"
      );
    },
  });

  const fetchStories = useCallback(async (): Promise<StorySummary[]> => {
    setError(null);

    try {
      return await queryClient.fetchQuery({
        queryKey: queryKeys.jobs.stories(),
        queryFn: () => apiClient.get<StorySummary[]>("/stories"),
      });
    } catch (queryError) {
      const message = queryError instanceof Error ? queryError.message : "Failed to fetch stories";
      setError(message);
      return [];
    }
  }, [queryClient]);

  const getStory = useCallback(
    async (id: string): Promise<Story | null> => {
      setCurrentStoryId(id);
      setError(null);

      try {
        return await queryClient.fetchQuery({
          queryKey: [...queryKeys.jobs.stories(), id],
          queryFn: () => apiClient.get<Story>(`/stories/${id}`),
        });
      } catch (queryError) {
        const message = queryError instanceof Error ? queryError.message : "Failed to fetch story";
        setError(message);
        return null;
      }
    },
    [queryClient]
  );

  const stories = storiesQuery.data ?? [];
  const currentStory = currentStoryQuery.data ?? null;
  const primaryStory = stories.find((story) => story.is_primary) ?? null;

  return {
    stories,
    currentStory,
    primaryStory,
    isLoading:
      storiesQuery.isLoading ||
      currentStoryQuery.isFetching ||
      createMutation.isPending ||
      updateMutation.isPending ||
      deleteMutation.isPending ||
      setPrimaryMutation.isPending,
    error:
      error ??
      (storiesQuery.error instanceof Error
        ? storiesQuery.error.message
        : currentStoryQuery.error instanceof Error
          ? currentStoryQuery.error.message
          : null),
    hasStories: stories.length > 0,
    fetchStories,
    getStory,
    createStory: async (data: StoryCreate) => {
      setError(null);
      try {
        return await createMutation.mutateAsync(data);
      } catch {
        return null;
      }
    },
    updateStory: async (id: string, data: StoryUpdate) => {
      setError(null);
      try {
        return await updateMutation.mutateAsync({ id, data });
      } catch {
        return null;
      }
    },
    deleteStory: async (id: string) => {
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
    setCurrentStory: (story: Story | null) => setCurrentStoryId(story?.id ?? null),
    setError,
  };
}
