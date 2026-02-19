"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { addMonths, startOfMonth, endOfMonth } from "date-fns";
import cronstrue from "cronstrue";
import { useSchedules, usePipelines } from "@/hooks";
import {
  EventCalendar,
  type CalendarEvent,
  type EventColor,
} from "@/components/schedules/event-calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  Switch,
} from "@/components/ui";
import type { ScheduledTask, ScheduledTaskCreate, CalendarOccurrence } from "@/types";
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  Edit2,
  PlayCircle,
  PauseCircle,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

function describeCron(expression: string): string | null {
  try {
    return cronstrue.toString(expression, { verbose: true });
  } catch {
    return null;
  }
}

const EVENT_COLORS: EventColor[] = ["sky", "amber", "violet", "rose", "emerald", "orange"];

export default function SchedulesPage() {
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
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null);
  const [formData, setFormData] = useState<ScheduledTaskCreate>({
    name: "",
    description: "",
    pipeline_name: "",
    cron_expression: "0 9 * * 1",
    timezone: "America/Los_Angeles",
    enabled: true,
    color: "sky",
  });

  // Fetch data on mount
  useEffect(() => {
    fetchSchedules();
    fetchPipelines();
  }, [fetchPipelines, fetchSchedules]);

  const refreshOccurrences = useCallback(() => {
    const start = startOfMonth(addMonths(currentDate, -1));
    const end = endOfMonth(addMonths(currentDate, 1));
    fetchOccurrences(start, end);
  }, [currentDate, fetchOccurrences]);

  // Fetch occurrences when date range changes
  useEffect(() => {
    refreshOccurrences();
  }, [refreshOccurrences]);

  // Convert occurrences to CalendarEvent format
  const calendarEvents: CalendarEvent[] = useMemo(() => {
    return occurrences.map((occ: CalendarOccurrence) => ({
      id: occ.id,
      title: occ.title,
      description: occ.description || undefined,
      start: new Date(occ.start),
      end: new Date(occ.end),
      allDay: occ.all_day,
      color: (occ.color as EventColor) || "sky",
    }));
  }, [occurrences]);

  const handleCalendarCreate = (_startTime?: Date) => {
    openNewScheduleDialog();
  };

  const handleCalendarSelect = (event: CalendarEvent) => {
    const occurrence = occurrences.find((o) => o.id === event.id);
    if (occurrence) {
      const task = schedules.find((s) => s.id === occurrence.task_id);
      if (task) {
        handleEdit(task);
      }
    }
  };

  const handleEventDelete = async (eventId: string) => {
    const occurrence = occurrences.find((o) => o.id === eventId);
    if (occurrence) {
      const confirmed = window.confirm(
        "This will delete the scheduled task and all its future occurrences. Continue?"
      );
      if (confirmed) {
        const success = await deleteSchedule(occurrence.task_id);
        if (success) {
          toast.success("Schedule deleted");
          refreshOccurrences();
        }
      }
    }
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.pipeline_name || !formData.cron_expression) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (editingTask) {
      const result = await updateSchedule(editingTask.id, formData);
      if (result) {
        toast.success("Schedule updated");
        setIsDialogOpen(false);
        setEditingTask(null);
        refreshOccurrences();
      }
    } else {
      const result = await createSchedule(formData);
      if (result) {
        toast.success("Schedule created");
        setIsDialogOpen(false);
        refreshOccurrences();
      }
    }
  };

  const handleToggle = async (task: ScheduledTask) => {
    const result = await toggleSchedule(task.id);
    if (result) {
      toast.success(result.enabled ? "Schedule enabled" : "Schedule paused");
      refreshOccurrences();
    }
  };

  const handleDelete = async (task: ScheduledTask) => {
    const confirmed = window.confirm(`Delete schedule "${task.name}"?`);
    if (confirmed) {
      const success = await deleteSchedule(task.id);
      if (success) {
        toast.success("Schedule deleted");
        refreshOccurrences();
      }
    }
  };

  const handleEdit = (task: ScheduledTask) => {
    setEditingTask(task);
    setFormData({
      name: task.name,
      description: task.description || "",
      pipeline_name: task.pipeline_name,
      cron_expression: task.cron_expression,
      timezone: task.timezone,
      enabled: task.enabled,
      color: task.color || "sky",
    });
    setIsDialogOpen(true);
  };

  const openNewScheduleDialog = () => {
    setEditingTask(null);
    setFormData({
      name: "",
      description: "",
      pipeline_name: "",
      cron_expression: "0 9 * * 1",
      timezone: "America/Los_Angeles",
      enabled: true,
      color: "sky",
    });
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Schedules</h1>
          <p className="text-muted-foreground">
            Schedule pipelines to run automatically on a recurring basis
          </p>
        </div>
        <Button onClick={openNewScheduleDialog}>
          <Plus className="mr-2 h-4 w-4" />
          New Schedule
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      )}

      {/* Calendar */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="h-[600px]">
            <EventCalendar
              events={calendarEvents}
              onEventDelete={handleEventDelete}
              onDateChange={setCurrentDate}
              onCreateEvent={handleCalendarCreate}
              onSelectEvent={handleCalendarSelect}
              initialView="month"
            />
          </div>
        </CardContent>
      </Card>

      {/* Scheduled Tasks List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Scheduled Tasks
          </CardTitle>
          <CardDescription>
            {schedules.length} scheduled task{schedules.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && schedules.length === 0 ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : schedules.length === 0 ? (
            <div className="py-8 text-center">
              <Calendar className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">No scheduled tasks yet</p>
              <Button className="mt-4" onClick={openNewScheduleDialog} variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Create your first schedule
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {schedules.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{
                        backgroundColor: task.color
                          ? `var(--color-${task.color}-500, #0ea5e9)`
                          : "#0ea5e9",
                      }}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{task.name}</span>
                        <Badge variant={task.enabled ? "default" : "secondary"}>
                          {task.enabled ? "Active" : "Paused"}
                        </Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span>{describeCron(task.cron_expression) ?? task.cron_expression}</span>
                        <span>|</span>
                        <span>{task.pipeline_name}</span>
                        {task.next_run_at && (
                          <>
                            <span>|</span>
                            <span>
                              Next: {new Date(task.next_run_at).toLocaleString()}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleToggle(task)}
                      title={task.enabled ? "Pause" : "Enable"}
                    >
                      {task.enabled ? (
                        <PauseCircle className="h-4 w-4" />
                      ) : (
                        <PlayCircle className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(task)}
                      title="Edit"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(task)}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingTask ? "Edit Schedule" : "Create Schedule"}
            </DialogTitle>
            <DialogDescription>
              {editingTask
                ? "Update the scheduled task settings"
                : "Schedule a pipeline to run automatically"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="Daily job search"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Optional description"
                value={formData.description || ""}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pipeline">Pipeline *</Label>
              <Select
                value={formData.pipeline_name}
                onValueChange={(value) => setFormData({ ...formData, pipeline_name: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a pipeline" />
                </SelectTrigger>
                <SelectContent>
                  {pipelines.map((pipeline) => (
                    <SelectItem key={pipeline.name} value={pipeline.name}>
                      {pipeline.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cron">Cron Expression *</Label>
              <Input
                id="cron"
                placeholder="0 9 * * 1"
                value={formData.cron_expression}
                onChange={(e) => setFormData({ ...formData, cron_expression: e.target.value })}
                className="font-mono"
              />
              {describeCron(formData.cron_expression) ? (
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  {describeCron(formData.cron_expression)}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Format: minute hour day-of-month month day-of-week (e.g.,{" "}
                  <code>0 9 * * 1</code> = every Monday at 9am)
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select
                value={formData.timezone}
                onValueChange={(value) => setFormData({ ...formData, timezone: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                  <SelectItem value="America/Denver">Mountain Time</SelectItem>
                  <SelectItem value="America/Chicago">Central Time</SelectItem>
                  <SelectItem value="America/New_York">Eastern Time</SelectItem>
                  <SelectItem value="UTC">UTC</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2">
                {EVENT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`h-8 w-8 rounded-full border-2 transition-all ${
                      formData.color === color ? "border-foreground scale-110" : "border-transparent"
                    }`}
                    style={{
                      backgroundColor: `var(--color-${color}-500, #${
                        color === "sky"
                          ? "0ea5e9"
                          : color === "amber"
                            ? "f59e0b"
                            : color === "violet"
                              ? "8b5cf6"
                              : color === "rose"
                                ? "f43f5e"
                                : color === "emerald"
                                  ? "10b981"
                                  : "f97316"
                      })`,
                    }}
                    onClick={() => setFormData({ ...formData, color })}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="enabled">Enabled</Label>
              <Switch
                id="enabled"
                checked={formData.enabled}
                onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isLoading}>
              {editingTask ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
