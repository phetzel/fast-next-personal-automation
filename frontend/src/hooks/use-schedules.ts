"use client";

import { useCallback, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useScheduleOccurrencesQuery, useSchedulesQuery } from "./queries/schedules";
import type {
  ScheduledTask,
  ScheduledTaskCreate,
  ScheduledTaskUpdate,
  CalendarOccurrence,
  ScheduledTaskListResponse,
  CalendarOccurrencesResponse,
} from "@/types";

interface OccurrenceRange {
  startDate: Date;
  endDate: Date;
}

export function useSchedules() {
  const queryClient = useQueryClient();
  const [occurrenceRange, setOccurrenceRange] = useState<OccurrenceRange | null>(null);
  const [error, setError] = useState<string | null>(null);
  const occurrenceRangeRef = useRef<OccurrenceRange | null>(null);

  occurrenceRangeRef.current = occurrenceRange;

  const schedulesQuery = useSchedulesQuery();
  const occurrencesQuery = useScheduleOccurrencesQuery(
    occurrenceRange?.startDate ?? new Date(),
    occurrenceRange?.endDate ?? new Date(),
    occurrenceRange !== null
  );

  const invalidateSchedules = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.schedules.all });
    if (occurrenceRangeRef.current) {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.schedules.occurrences({
          start_date: occurrenceRangeRef.current.startDate.toISOString(),
          end_date: occurrenceRangeRef.current.endDate.toISOString(),
        }),
      });
    }
  }, [queryClient]);

  const createMutation = useMutation({
    mutationFn: (data: ScheduledTaskCreate) => apiClient.post<ScheduledTask>("/schedules", data),
    onSuccess: invalidateSchedules,
    onError: (mutationError) => {
      setError(
        mutationError instanceof Error ? mutationError.message : "Failed to create schedule"
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ScheduledTaskUpdate }) =>
      apiClient.put<ScheduledTask>(`/schedules/${id}`, data),
    onSuccess: invalidateSchedules,
    onError: (mutationError) => {
      setError(
        mutationError instanceof Error ? mutationError.message : "Failed to update schedule"
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/schedules/${id}`),
    onSuccess: invalidateSchedules,
    onError: (mutationError) => {
      setError(
        mutationError instanceof Error ? mutationError.message : "Failed to delete schedule"
      );
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => apiClient.post<ScheduledTask>(`/schedules/${id}/toggle`),
    onSuccess: invalidateSchedules,
    onError: (mutationError) => {
      setError(
        mutationError instanceof Error ? mutationError.message : "Failed to toggle schedule"
      );
    },
  });

  const fetchSchedules = useCallback(async (): Promise<ScheduledTask[]> => {
    setError(null);

    try {
      const response = await queryClient.fetchQuery({
        queryKey: queryKeys.schedules.list(),
        queryFn: () => apiClient.get<ScheduledTaskListResponse>("/schedules"),
      });
      return response.tasks;
    } catch (queryError) {
      const message =
        queryError instanceof Error ? queryError.message : "Failed to fetch schedules";
      setError(message);
      return [];
    }
  }, [queryClient]);

  const fetchOccurrences = useCallback(
    async (startDate: Date, endDate: Date): Promise<CalendarOccurrence[]> => {
      setOccurrenceRange({ startDate, endDate });
      setError(null);

      try {
        const params = new URLSearchParams({
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
        });
        const response = await queryClient.fetchQuery({
          queryKey: queryKeys.schedules.occurrences({
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
          }),
          queryFn: () =>
            apiClient.get<CalendarOccurrencesResponse>(`/schedules/occurrences?${params}`),
        });
        return response.occurrences;
      } catch (queryError) {
        const message =
          queryError instanceof Error ? queryError.message : "Failed to fetch calendar events";
        setError(message);
        return [];
      }
    },
    [queryClient]
  );

  return {
    schedules: schedulesQuery.data?.tasks ?? [],
    occurrences: occurrencesQuery.data?.occurrences ?? [],
    total: schedulesQuery.data?.total ?? 0,
    isLoading:
      schedulesQuery.isLoading ||
      schedulesQuery.isFetching ||
      occurrencesQuery.isFetching ||
      createMutation.isPending ||
      updateMutation.isPending ||
      deleteMutation.isPending ||
      toggleMutation.isPending,
    error:
      error ??
      (schedulesQuery.error instanceof Error
        ? schedulesQuery.error.message
        : occurrencesQuery.error instanceof Error
          ? occurrencesQuery.error.message
          : null),
    fetchSchedules,
    fetchOccurrences,
    createSchedule: async (data: ScheduledTaskCreate) => {
      setError(null);
      try {
        return await createMutation.mutateAsync(data);
      } catch {
        return null;
      }
    },
    updateSchedule: async (id: string, data: ScheduledTaskUpdate) => {
      setError(null);
      try {
        return await updateMutation.mutateAsync({ id, data });
      } catch {
        return null;
      }
    },
    deleteSchedule: async (id: string) => {
      setError(null);
      try {
        await deleteMutation.mutateAsync(id);
        return true;
      } catch {
        return false;
      }
    },
    toggleSchedule: async (id: string) => {
      setError(null);
      try {
        return await toggleMutation.mutateAsync(id);
      } catch {
        return null;
      }
    },
    setError,
  };
}
