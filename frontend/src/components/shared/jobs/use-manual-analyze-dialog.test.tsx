import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useManualAnalyzeDialog } from "./use-manual-analyze-dialog";
import type { Job } from "@/types";

const baseJob: Job = {
  id: "job-1",
  user_id: "user-1",
  title: "Backend Engineer",
  company: "Acme",
  location: "Remote",
  description: "Build APIs",
  job_url: "https://jobs.example.com/backend-engineer",
  salary_range: null,
  date_posted: null,
  source: "linkedin",
  ingestion_source: "manual",
  relevance_score: null,
  reasoning: null,
  status: "new",
  search_terms: null,
  notes: null,
  is_remote: true,
  job_type: "full-time",
  company_url: null,
  cover_letter: null,
  cover_letter_file_path: null,
  cover_letter_generated_at: null,
  prep_notes: null,
  prepped_at: null,
  application_type: null,
  application_url: null,
  requires_cover_letter: false,
  requires_resume: true,
  detected_fields: null,
  screening_questions: null,
  screening_answers: null,
  analyzed_at: null,
  applied_at: null,
  application_method: null,
  confirmation_code: null,
  created_at: "2026-03-14T00:00:00Z",
  updated_at: null,
};

describe("useManualAnalyzeDialog", () => {
  it("opens, completes, and closes around the selected job", () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useManualAnalyzeDialog({ onComplete }));

    act(() => {
      result.current.open(baseJob);
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.job).toEqual(baseJob);

    const updatedJob = {
      ...baseJob,
      status: "analyzed" as const,
      requires_cover_letter: true,
    };

    act(() => {
      result.current.complete(updatedJob);
    });

    expect(onComplete).toHaveBeenCalledWith(updatedJob);
    expect(result.current.job).toEqual(updatedJob);
    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.close();
    });

    expect(result.current.isOpen).toBe(false);
    expect(result.current.job).toBeNull();
  });
});
