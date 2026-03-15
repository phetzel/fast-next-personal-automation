"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { addMonths, endOfMonth, startOfMonth } from "date-fns";
import { usePipelines, useSchedules } from "@/hooks";
import { useConfirmDialog } from "@/components/shared/feedback";
import { ROUTES } from "@/lib/constants";
import type {
  CalendarOccurrence,
  CalendarRunEvent,
  ScheduledTask,
  ScheduledTaskCreate,
  SystemTask,
} from "@/types";
import type { CalendarEvent, EventColor } from "./event-calendar";
import { EVENT_COLORS } from "./schedule-utils";
import { toast } from "sonner";

export function useSchedulesScreen() {
  const confirmDialog = useConfirmDialog();
  const router = useRouter();
  const {
    schedules,
    occurrences,
    isLoading,
    error,
    fetchSchedules,
    fetchOccurrences,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    toggleSchedule,
  } = useSchedules();
  const { pipelines, fetchPipelines } = usePipelines();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [recurringOccurrences, setRecurringOccurrences] = useState<CalendarOccurrence[]>([]);
  const [pastRunEvents, setPastRunEvents] = useState<CalendarRunEvent[]>([]);
  const [systemTasks, setSystemTasks] = useState<SystemTask[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null);
  const [formData, setFormData] = useState<ScheduledTaskCreate>({
    name: "",
    description: "",
    pipeline_name: "",
    cron_expression: "0 9 * * 1",
    timezone: "America/Los_Angeles",
    enabled: true,
    color: EVENT_COLORS[0],
  });

  useEffect(() => {
    void fetchSchedules();
    void fetchPipelines();

    void fetch("/api/schedules/system-tasks")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.tasks) {
          setSystemTasks(data.tasks);
        }
      })
      .catch(() => {});
  }, [fetchPipelines, fetchSchedules]);

  const refreshOccurrences = useCallback(async () => {
    const start = startOfMonth(addMonths(currentDate, -1));
    const end = endOfMonth(addMonths(currentDate, 1));
    const toDateStr = (date: Date) => date.toISOString().split("T")[0];

    void fetchOccurrences(start, end);

    const runsQuery = new URLSearchParams({
      start_date: start.toISOString(),
      end_date: end.toISOString(),
    });

    void fetch(`/api/schedules/runs-calendar?${runsQuery}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.events) {
          setPastRunEvents(data.events);
        }
      })
      .catch(() => {});

    const recurringQuery = new URLSearchParams({
      start_date: toDateStr(start),
      end_date: toDateStr(end),
    });

    void fetch(`/api/finances/recurring/calendar?${recurringQuery}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.occurrences) {
          setRecurringOccurrences(data.occurrences);
        }
      })
      .catch(() => {});
  }, [currentDate, fetchOccurrences]);

  useEffect(() => {
    void refreshOccurrences();
  }, [refreshOccurrences]);

  const calendarEvents = useMemo<CalendarEvent[]>(() => {
    const now = new Date();

    const futureOccurrenceEvents = occurrences
      .filter((occurrence) => new Date(occurrence.start) >= now)
      .map((occurrence) => ({
        id: occurrence.id,
        title: occurrence.title,
        description: occurrence.description || undefined,
        start: new Date(occurrence.start),
        end: new Date(occurrence.end),
        allDay: occurrence.all_day,
        color: (occurrence.color as EventColor) || "sky",
      }));

    const pastEvents = pastRunEvents.map((run) => ({
      id: run.id,
      title: run.title,
      start: new Date(run.start),
      end: new Date(run.end),
      allDay: run.all_day,
      color: (run.color as EventColor) || "sky",
    }));

    const recurringEvents = recurringOccurrences.map((occurrence) => ({
      id: occurrence.id,
      title: occurrence.title,
      description: occurrence.description || undefined,
      start: new Date(occurrence.start),
      end: new Date(occurrence.end),
      allDay: occurrence.all_day,
      color: "rose" as const,
    }));

    return [...futureOccurrenceEvents, ...pastEvents, ...recurringEvents];
  }, [occurrences, pastRunEvents, recurringOccurrences]);

  const openNewScheduleDialog = useCallback(() => {
    setEditingTask(null);
    setFormData({
      name: "",
      description: "",
      pipeline_name: "",
      cron_expression: "0 9 * * 1",
      timezone: "America/Los_Angeles",
      enabled: true,
      color: EVENT_COLORS[0],
    });
    setIsDialogOpen(true);
  }, []);

  const closeScheduleDialog = useCallback(() => {
    setIsDialogOpen(false);
    setEditingTask(null);
  }, []);

  const handleCalendarCreate = useCallback(() => {
    openNewScheduleDialog();
  }, [openNewScheduleDialog]);

  const handleCalendarSelect = useCallback(
    (event: CalendarEvent) => {
      if (event.id.startsWith("recurring_")) {
        router.push(ROUTES.FINANCES_RECURRING);
        return;
      }

      if (event.id.startsWith("run_")) {
        return;
      }

      const occurrence = occurrences.find((item) => item.id === event.id);
      if (!occurrence) {
        return;
      }

      const task = schedules.find((item) => item.id === occurrence.task_id);
      if (!task) {
        return;
      }

      setEditingTask(task);
      setFormData({
        name: task.name,
        description: task.description || "",
        pipeline_name: task.pipeline_name,
        cron_expression: task.cron_expression,
        timezone: task.timezone,
        enabled: task.enabled,
        color: task.color || EVENT_COLORS[0],
      });
      setIsDialogOpen(true);
    },
    [occurrences, router, schedules]
  );

  const handleEventDelete = useCallback(
    async (eventId: string) => {
      if (eventId.startsWith("recurring_") || eventId.startsWith("run_")) {
        return;
      }

      const occurrence = occurrences.find((item) => item.id === eventId);
      if (!occurrence) {
        return;
      }

      const confirmed = await confirmDialog({
        title: "Delete scheduled task?",
        description: "This will delete the scheduled task and all its future occurrences.",
        confirmLabel: "Delete schedule",
        destructive: true,
      });

      if (!confirmed) {
        return;
      }

      const success = await deleteSchedule(occurrence.task_id);
      if (success) {
        toast.success("Schedule deleted");
        await refreshOccurrences();
      }
    },
    [confirmDialog, deleteSchedule, occurrences, refreshOccurrences]
  );

  const handleSubmit = useCallback(async () => {
    if (!formData.name || !formData.pipeline_name || !formData.cron_expression) {
      toast.error("Please fill in all required fields");
      return;
    }

    const result = editingTask
      ? await updateSchedule(editingTask.id, formData)
      : await createSchedule(formData);

    if (!result) {
      return;
    }

    toast.success(editingTask ? "Schedule updated" : "Schedule created");
    closeScheduleDialog();
    await refreshOccurrences();
  }, [
    closeScheduleDialog,
    createSchedule,
    editingTask,
    formData,
    refreshOccurrences,
    updateSchedule,
  ]);

  const handleToggle = useCallback(
    async (task: ScheduledTask) => {
      const result = await toggleSchedule(task.id);
      if (result) {
        toast.success(result.enabled ? "Schedule enabled" : "Schedule paused");
        await refreshOccurrences();
      }
    },
    [refreshOccurrences, toggleSchedule]
  );

  const handleDelete = useCallback(
    async (task: ScheduledTask) => {
      const confirmed = await confirmDialog({
        title: `Delete schedule "${task.name}"?`,
        description: "This will permanently remove the selected schedule.",
        confirmLabel: "Delete schedule",
        destructive: true,
      });

      if (!confirmed) {
        return;
      }

      const success = await deleteSchedule(task.id);
      if (success) {
        toast.success("Schedule deleted");
        await refreshOccurrences();
      }
    },
    [confirmDialog, deleteSchedule, refreshOccurrences]
  );

  const handleEdit = useCallback((task: ScheduledTask) => {
    setEditingTask(task);
    setFormData({
      name: task.name,
      description: task.description || "",
      pipeline_name: task.pipeline_name,
      cron_expression: task.cron_expression,
      timezone: task.timezone,
      enabled: task.enabled,
      color: task.color || EVENT_COLORS[0],
    });
    setIsDialogOpen(true);
  }, []);

  return {
    schedules,
    calendarEvents,
    systemTasks,
    pipelines,
    isLoading,
    error,
    isDialogOpen,
    editingTask,
    formData,
    currentDate,
    setCurrentDate,
    setFormData,
    closeScheduleDialog,
    openNewScheduleDialog,
    handleCalendarCreate,
    handleCalendarSelect,
    handleEventDelete,
    handleSubmit,
    handleToggle,
    handleDelete,
    handleEdit,
  };
}
