"use client";

import { useCallback, useState } from "react";
import { apiClient } from "@/lib/api-client";

/**
 * Generic state for CRUD operations.
 */
export interface CrudState<T, TSummary = T> {
  items: TSummary[];
  currentItem: T | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Options for creating a CRUD hook.
 */
export interface CrudHookOptions<T, TSummary = T, TCreate = Partial<T>, TUpdate = Partial<T>> {
  /** Base API endpoint (e.g., "/stories", "/resumes") */
  endpoint: string;
  /** Entity name for error messages (e.g., "story", "resume") */
  entityName: string;
  /** Transform function for items (optional) */
  transformItem?: (item: unknown) => T;
  /** Transform function for summary items (optional) */
  transformSummary?: (item: unknown) => TSummary;
}

/**
 * Result from the CRUD hook factory.
 */
export interface CrudHookResult<T, TSummary = T, TCreate = Partial<T>, TUpdate = Partial<T>> {
  // State
  items: TSummary[];
  currentItem: T | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchAll: () => Promise<TSummary[]>;
  fetchOne: (id: string) => Promise<T | null>;
  create: (data: TCreate) => Promise<T | null>;
  update: (id: string, data: TUpdate) => Promise<T | null>;
  remove: (id: string) => Promise<boolean>;
  setCurrentItem: (item: T | null) => void;
  setError: (error: string | null) => void;
}

/**
 * Extended options for entities with primary/default flag.
 */
export interface PrimaryCrudHookOptions<
  T,
  TSummary = T,
  TCreate = Partial<T>,
  TUpdate = Partial<T>,
> extends CrudHookOptions<T, TSummary, TCreate, TUpdate> {
  /** Field name for the primary flag (default: "is_primary") */
  primaryField?: keyof TSummary & string;
}

/**
 * Extended result for entities with primary/default flag.
 */
export interface PrimaryCrudHookResult<
  T,
  TSummary = T,
  TCreate = Partial<T>,
  TUpdate = Partial<T>,
> extends CrudHookResult<T, TSummary, TCreate, TUpdate> {
  primaryItem: TSummary | null;
  hasItems: boolean;
  setPrimary: (id: string) => Promise<T | null>;
}

/**
 * Factory function to create a basic CRUD hook.
 *
 * Example:
 * ```ts
 * export function useProjects() {
 *   return useCrud<Project, ProjectSummary, ProjectCreate, ProjectUpdate>({
 *     endpoint: "/projects",
 *     entityName: "project",
 *   });
 * }
 * ```
 */
export function useCrud<T, TSummary = T, TCreate = Partial<T>, TUpdate = Partial<T>>(
  options: CrudHookOptions<T, TSummary, TCreate, TUpdate>
): CrudHookResult<T, TSummary, TCreate, TUpdate> {
  const { endpoint, entityName, transformItem, transformSummary } = options;

  const [items, setItems] = useState<TSummary[]>([]);
  const [currentItem, setCurrentItem] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async (): Promise<TSummary[]> => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await apiClient.get<TSummary[]>(endpoint);
      const transformed = transformSummary ? data.map(transformSummary) : data;
      setItems(transformed);
      return transformed;
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to fetch ${entityName}s`;
      setError(message);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [endpoint, entityName, transformSummary]);

  const fetchOne = useCallback(
    async (id: string): Promise<T | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await apiClient.get<T>(`${endpoint}/${id}`);
        const transformed = transformItem ? transformItem(data) : data;
        setCurrentItem(transformed);
        return transformed;
      } catch (err) {
        const message = err instanceof Error ? err.message : `Failed to fetch ${entityName}`;
        setError(message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [endpoint, entityName, transformItem]
  );

  const create = useCallback(
    async (data: TCreate): Promise<T | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const created = await apiClient.post<T>(endpoint, data);
        const transformed = transformItem ? transformItem(created) : created;
        await fetchAll();
        return transformed;
      } catch (err) {
        const message = err instanceof Error ? err.message : `Failed to create ${entityName}`;
        setError(message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [endpoint, entityName, transformItem, fetchAll]
  );

  const update = useCallback(
    async (id: string, data: TUpdate): Promise<T | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const updated = await apiClient.patch<T>(`${endpoint}/${id}`, data);
        const transformed = transformItem ? transformItem(updated) : updated;
        await fetchAll();
        return transformed;
      } catch (err) {
        const message = err instanceof Error ? err.message : `Failed to update ${entityName}`;
        setError(message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [endpoint, entityName, transformItem, fetchAll]
  );

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        await apiClient.delete(`${endpoint}/${id}`);
        if (currentItem && (currentItem as { id?: string }).id === id) {
          setCurrentItem(null);
        }
        await fetchAll();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : `Failed to delete ${entityName}`;
        setError(message);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [endpoint, entityName, currentItem, fetchAll]
  );

  return {
    items,
    currentItem,
    isLoading,
    error,
    fetchAll,
    fetchOne,
    create,
    update,
    remove,
    setCurrentItem,
    setError,
  };
}

/**
 * Factory function to create a CRUD hook for entities with a primary/default flag.
 *
 * Example:
 * ```ts
 * export function useStories() {
 *   return usePrimaryCrud<Story, StorySummary, StoryCreate, StoryUpdate>({
 *     endpoint: "/stories",
 *     entityName: "story",
 *   });
 * }
 * ```
 */
export function usePrimaryCrud<T, TSummary = T, TCreate = Partial<T>, TUpdate = Partial<T>>(
  options: PrimaryCrudHookOptions<T, TSummary, TCreate, TUpdate>
): PrimaryCrudHookResult<T, TSummary, TCreate, TUpdate> {
  const { primaryField = "is_primary" } = options;
  const crud = useCrud<T, TSummary, TCreate, TUpdate>(options);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setPrimary = useCallback(
    async (id: string): Promise<T | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const updated = await apiClient.post<T>(`${options.endpoint}/${id}/set-primary`);
        await crud.fetchAll();
        return updated;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : `Failed to set primary ${options.entityName}`;
        setError(message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [options.endpoint, options.entityName, crud]
  );

  const primaryItem =
    crud.items.find((item) => (item as Record<string, unknown>)[primaryField]) || null;
  const hasItems = crud.items.length > 0;

  return {
    ...crud,
    isLoading: crud.isLoading || isLoading,
    error: crud.error || error,
    primaryItem,
    hasItems,
    setPrimary,
    setError: (err) => {
      setError(err);
      crud.setError(err);
    },
  };
}
