"use client";

import { useCallback, useState } from "react";
import { apiClient } from "@/lib/api-client";
import type { Story, StorySummary, StoryCreate, StoryUpdate } from "@/types";

/**
 * Hook for managing stories.
 * Supports create, list, update, delete, and set primary operations.
 */
export function useStories() {
  const [stories, setStories] = useState<StorySummary[]>([]);
  const [currentStory, setCurrentStory] = useState<Story | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch all stories for the current user.
   */
  const fetchStories = useCallback(async (): Promise<StorySummary[]> => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await apiClient.get<StorySummary[]>("/stories");
      setStories(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch stories");
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Get a specific story by ID.
   */
  const getStory = useCallback(async (id: string): Promise<Story | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await apiClient.get<Story>(`/stories/${id}`);
      setCurrentStory(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch story");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Create a new story.
   */
  const createStory = useCallback(
    async (data: StoryCreate): Promise<Story | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const created = await apiClient.post<Story>("/stories", data);
        // Refresh stories list
        await fetchStories();
        return created;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create story");
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchStories]
  );

  /**
   * Update a story.
   */
  const updateStory = useCallback(
    async (id: string, data: StoryUpdate): Promise<Story | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const updated = await apiClient.patch<Story>(`/stories/${id}`, data);
        // Refresh stories list
        await fetchStories();
        return updated;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update story");
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchStories]
  );

  /**
   * Delete a story.
   */
  const deleteStory = useCallback(
    async (id: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        await apiClient.delete(`/stories/${id}`);
        // Clear current story if it's the one we deleted
        if (currentStory?.id === id) {
          setCurrentStory(null);
        }
        // Refresh stories list
        await fetchStories();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete story");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [currentStory, fetchStories]
  );

  /**
   * Set a story as primary.
   */
  const setPrimary = useCallback(
    async (id: string): Promise<Story | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const updated = await apiClient.post<Story>(`/stories/${id}/set-primary`);
        // Refresh stories list to update primary status
        await fetchStories();
        return updated;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to set primary story");
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchStories]
  );

  /**
   * Get the primary story from the loaded stories.
   */
  const primaryStory = stories.find((s) => s.is_primary) || null;

  /**
   * Check if user has any stories.
   */
  const hasStories = stories.length > 0;

  return {
    stories,
    currentStory,
    primaryStory,
    isLoading,
    error,
    hasStories,
    fetchStories,
    getStory,
    createStory,
    updateStory,
    deleteStory,
    setPrimary,
    setCurrentStory,
    setError,
  };
}

