/**
 * Schedule/Scheduled Task types matching backend schemas.
 */

export type EventColor = "sky" | "amber" | "violet" | "rose" | "emerald" | "orange";

/**
 * Scheduled task as returned from the API.
 */
export interface ScheduledTask {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  pipeline_name: string;
  cron_expression: string;
  timezone: string;
  enabled: boolean;
  input_params: Record<string, unknown> | null;
  color: EventColor | null;
  next_run_at: string | null;
  last_run_at: string | null;
  created_at: string;
  updated_at: string | null;
}

/**
 * Create scheduled task payload.
 */
export interface ScheduledTaskCreate {
  name: string;
  description?: string | null;
  pipeline_name: string;
  cron_expression: string;
  timezone?: string;
  enabled?: boolean;
  input_params?: Record<string, unknown> | null;
  color?: EventColor | null;
}

/**
 * Update scheduled task payload.
 */
export interface ScheduledTaskUpdate {
  name?: string;
  description?: string | null;
  pipeline_name?: string;
  cron_expression?: string;
  timezone?: string;
  enabled?: boolean;
  input_params?: Record<string, unknown> | null;
  color?: EventColor | null;
}

/**
 * List response with pagination.
 */
export interface ScheduledTaskListResponse {
  tasks: ScheduledTask[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

/**
 * Calendar occurrence (computed from cron expression).
 */
export interface CalendarOccurrence {
  id: string;
  task_id: string;
  title: string;
  description: string | null;
  pipeline_name: string;
  start: string;
  end: string;
  all_day: boolean;
  color: EventColor | null;
  cron_expression: string;
  enabled: boolean;
}

/**
 * Calendar occurrences response.
 */
export interface CalendarOccurrencesResponse {
  occurrences: CalendarOccurrence[];
  start_date: string;
  end_date: string;
}

/**
 * A past pipeline run formatted as a calendar event.
 */
export interface CalendarRunEvent {
  id: string;
  run_id: string;
  title: string;
  pipeline_name: string;
  start: string;
  end: string;
  all_day: boolean;
  color: EventColor | null;
  status: string;
  trigger_type: string;
  scheduled_task_id: string | null;
  duration_ms: number | null;
}

/**
 * Response containing past pipeline runs as calendar events.
 */
export interface CalendarRunsResponse {
  events: CalendarRunEvent[];
  start_date: string;
  end_date: string;
}

/**
 * A hardcoded system cron task (not user-manageable).
 */
export interface SystemTask {
  id: string;
  name: string;
  description: string;
  cron_expression: string;
  timezone: string;
  is_system: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
}

/**
 * Response containing system cron tasks.
 */
export interface SystemTasksResponse {
  tasks: SystemTask[];
}
