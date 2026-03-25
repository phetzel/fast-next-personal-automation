"use client";

import { useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useSchedulesQuery } from "./queries/schedules";
import type { EmailSource, ScheduledTask, ScheduledTaskCreate } from "@/types";

const DEFAULT_TIMEZONE = "America/Los_Angeles";

export function buildEmailTriageSchedulePayload(
  sources: EmailSource[],
  schedules: ScheduledTask[],
  timezone = DEFAULT_TIMEZONE
): ScheduledTaskCreate | null {
  const hasActiveSource = sources.some((source) => source.is_active);
  const hasExistingSchedule = schedules.some((task) => task.pipeline_name === "email_triage");

  if (!hasActiveSource || hasExistingSchedule) {
    return null;
  }

  return {
    name: "Daily email triage",
    description: "Default read-only daily inbox triage.",
    pipeline_name: "email_triage",
    cron_expression: "0 8 * * *",
    timezone,
    enabled: true,
    color: "amber",
  };
}

export function useEnsureEmailTriageSchedule(sources: EmailSource[]) {
  const schedulesQuery = useSchedulesQuery();
  const queryClient = useQueryClient();
  const attemptedCreationRef = useRef(false);

  const createMutation = useMutation({
    mutationFn: (payload: ScheduledTaskCreate) => apiClient.post("/schedules", payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.schedules.all });
    },
    onError: () => {
      attemptedCreationRef.current = false;
    },
  });

  useEffect(() => {
    if (!schedulesQuery.data?.tasks) {
      return;
    }

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone?.trim() || DEFAULT_TIMEZONE;
    const payload = buildEmailTriageSchedulePayload(sources, schedulesQuery.data.tasks, timezone);

    if (!payload || attemptedCreationRef.current || createMutation.isPending) {
      return;
    }

    attemptedCreationRef.current = true;
    createMutation.mutate(payload);
  }, [createMutation, schedulesQuery.data?.tasks, sources]);
}
