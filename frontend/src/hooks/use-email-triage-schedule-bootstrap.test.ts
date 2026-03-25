import { describe, expect, it } from "vitest";
import { buildEmailTriageSchedulePayload } from "./use-email-triage-schedule-bootstrap";
import type { EmailSource, ScheduledTask } from "@/types";

function makeSource(overrides: Partial<EmailSource> = {}): EmailSource {
  return {
    id: "source-1",
    email_address: "email@example.com",
    provider: "gmail",
    is_active: true,
    last_sync_at: null,
    last_sync_error: null,
    last_triage_at: null,
    last_triage_error: null,
    custom_senders: null,
    auto_actions_enabled: true,
    auto_action_confidence_threshold: 0.95,
    created_at: "2026-03-23T00:00:00Z",
    updated_at: null,
    ...overrides,
  };
}

function makeSchedule(overrides: Partial<ScheduledTask> = {}): ScheduledTask {
  return {
    id: "task-1",
    user_id: "user-1",
    name: "Existing task",
    description: null,
    pipeline_name: "email_sync_jobs",
    cron_expression: "0 8 * * *",
    timezone: "UTC",
    enabled: true,
    input_params: null,
    color: "sky",
    next_run_at: null,
    last_run_at: null,
    created_at: "2026-03-23T00:00:00Z",
    updated_at: null,
    ...overrides,
  };
}

describe("buildEmailTriageSchedulePayload", () => {
  it("creates a default triage schedule when an active source exists and none is configured", () => {
    const payload = buildEmailTriageSchedulePayload(
      [makeSource()],
      [makeSchedule()],
      "America/New_York"
    );

    expect(payload).toEqual({
      name: "Daily email triage",
      description: "Default read-only daily inbox triage.",
      pipeline_name: "email_triage",
      cron_expression: "0 8 * * *",
      timezone: "America/New_York",
      enabled: true,
      color: "amber",
    });
  });

  it("returns null when a triage schedule already exists", () => {
    const payload = buildEmailTriageSchedulePayload(
      [makeSource()],
      [makeSchedule({ pipeline_name: "email_triage" })]
    );

    expect(payload).toBeNull();
  });
});
