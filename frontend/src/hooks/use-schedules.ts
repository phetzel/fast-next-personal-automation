"use client";

import { useCallback, useState } from "react";
import { apiClient } from "@/lib/api-client";
import type {
  ScheduledTask,
  ScheduledTaskCreate,
  ScheduledTaskUpdate,
  ScheduledTaskListResponse,
  CalendarOccurrence,
  CalendarOccurrencesResponse,
} from "@/types";

interface SchedulesState {
  schedules: ScheduledTask[];
  occurrences: CalendarOccurrence[];
  total: number;
  isLoading: boolean;
  error: string | null;
}

interface UseSchedulesResult extends SchedulesState {
  fetchSchedules: () => Promise<ScheduledTask[]>;
  fetchOccurrences: (startDate: Date, endDate: Date) => Promise<CalendarOccurrence[]>;
  createSchedule: (data: ScheduledTaskCreate) => Promise<ScheduledTask | null>;
  updateSchedule: (id: string, data: ScheduledTaskUpdate) => Promise<ScheduledTask | null>;
  deleteSchedule: (id: string) => Promise<boolean>;
  toggleSchedule: (id: string) => Promise<ScheduledTask | null>;
  setError: (error: string | null) => void;
}

/**
 * Hook for managing scheduled tasks and calendar occurrences.
 */
export function useSchedules(): UseSchedulesResult {
  const [schedules, setSchedules] = useState<ScheduledTask[]>([]);
  const [occurrences, setOccurrences] = useState<CalendarOccurrence[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSchedules = useCallback(async (): Promise<ScheduledTask[]> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.get<ScheduledTaskListResponse>("/schedules");
      setSchedules(response.tasks);
      setTotal(response.total);
      return response.tasks;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch schedules";
      setError(message);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchOccurrences = useCallback(
    async (startDate: Date, endDate: Date): Promise<CalendarOccurrence[]> => {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
        });
        const response = await apiClient.get<CalendarOccurrencesResponse>(
          `/schedules/occurrences?${params}`
        );
        setOccurrences(response.occurrences);
        return response.occurrences;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch calendar events";
        setError(message);
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const createSchedule = useCallback(
    async (data: ScheduledTaskCreate): Promise<ScheduledTask | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const created = await apiClient.post<ScheduledTask>("/schedules", data);
        await fetchSchedules();
        return created;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create schedule";
        setError(message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchSchedules]
  );

  const updateSchedule = useCallback(
    async (id: string, data: ScheduledTaskUpdate): Promise<ScheduledTask | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const updated = await apiClient.put<ScheduledTask>(`/schedules/${id}`, data);
        await fetchSchedules();
        return updated;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update schedule";
        setError(message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchSchedules]
  );

  const deleteSchedule = useCallback(
    async (id: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        await apiClient.delete(`/schedules/${id}`);
        await fetchSchedules();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to delete schedule";
        setError(message);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchSchedules]
  );

  const toggleSchedule = useCallback(
    async (id: string): Promise<ScheduledTask | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const toggled = await apiClient.post<ScheduledTask>(`/schedules/${id}/toggle`);
        await fetchSchedules();
        return toggled;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to toggle schedule";
        setError(message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchSchedules]
  );

  return {
    schedules,
    occurrences,
    total,
    isLoading,
    error,
    fetchSchedules,
    fetchOccurrences,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    toggleSchedule,
    setError,
  };
}
