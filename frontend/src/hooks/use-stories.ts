"use client";

import { usePrimaryCrud } from "./use-crud";
import type { Story, StorySummary, StoryCreate, StoryUpdate } from "@/types";

/**
 * Hook for managing stories.
 * Supports create, list, update, delete, and set primary operations.
 *
 * Built on usePrimaryCrud factory for consistent CRUD patterns.
 */
export function useStories() {
  const crud = usePrimaryCrud<Story, StorySummary, StoryCreate, StoryUpdate>({
    endpoint: "/stories",
    entityName: "story",
  });

  return {
    // State
    stories: crud.items,
    currentStory: crud.currentItem,
    primaryStory: crud.primaryItem,
    isLoading: crud.isLoading,
    error: crud.error,
    hasStories: crud.hasItems,

    // Actions
    fetchStories: crud.fetchAll,
    getStory: crud.fetchOne,
    createStory: crud.create,
    updateStory: (id: string, data: StoryUpdate) => crud.update(id, data),
    deleteStory: crud.remove,
    setPrimary: crud.setPrimary,
    setCurrentStory: crud.setCurrentItem,
    setError: crud.setError,
  };
}
