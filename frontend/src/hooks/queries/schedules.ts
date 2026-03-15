"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type { CalendarOccurrencesResponse, ScheduledTaskListResponse } from "@/types";

export function useSchedulesQuery() {
  return useQuery({
    queryKey: queryKeys.schedules.list(),
    queryFn: () => apiClient.get<ScheduledTaskListResponse>("/schedules"),
  });
}

export function useScheduleOccurrencesQuery(startDate: Date, endDate: Date, enabled = true) {
  const params = new URLSearchParams({
    start_date: startDate.toISOString(),
    end_date: endDate.toISOString(),
  });

  return useQuery({
    queryKey: queryKeys.schedules.occurrences({
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
    }),
    queryFn: () => apiClient.get<CalendarOccurrencesResponse>(`/schedules/occurrences?${params}`),
    enabled,
  });
}
