import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type { Job } from "@/types";
import { useJobMutations } from "./use-job-mutations";

vi.mock("@/lib/api-client", () => ({
  apiClient: {
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockPost = vi.mocked(apiClient.post);

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

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

describe("useJobMutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a job and refreshes the relevant caches", async () => {
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const onJobCreated = vi.fn();
    mockPost.mockResolvedValueOnce(baseJob);

    const { result } = renderHook(() => useJobMutations({ onJobCreated }), {
      wrapper: createWrapper(queryClient),
    });

    let createdJob: Job | null = null;

    await act(async () => {
      createdJob = await result.current.createJob({
        title: baseJob.title,
        company: baseJob.company,
        job_url: baseJob.job_url,
      });
    });

    expect(createdJob).toEqual(baseJob);
    expect(onJobCreated).toHaveBeenCalledWith(baseJob);
    expect(mockPost).toHaveBeenCalledWith("/jobs", {
      title: baseJob.title,
      company: baseJob.company,
      job_url: baseJob.job_url,
    });
    expect(queryClient.getQueryData(queryKeys.jobs.detail(baseJob.id))).toEqual(baseJob);

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.jobs.all });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.jobs.stats() });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.jobs.detail(baseJob.id),
      });
    });
  });

  it("returns a surfaced error when manual analyze fails", async () => {
    const queryClient = createQueryClient();
    mockPost.mockRejectedValueOnce(new Error("Analyze failed"));

    const { result } = renderHook(() => useJobMutations(), {
      wrapper: createWrapper(queryClient),
    });

    let updatedJob: Job | null = baseJob;

    await act(async () => {
      updatedJob = await result.current.manualAnalyzeJob(baseJob.id, {
        requires_cover_letter: true,
        screening_questions: ["Why do you want this role?"],
      });
    });

    expect(updatedJob).toBeNull();
    await waitFor(() => {
      expect(result.current.error).toBe("Analyze failed");
    });
  });

  it("uses the batch delete route and returns the deleted count", async () => {
    const queryClient = createQueryClient();
    mockPost.mockResolvedValueOnce({ deleted_count: 3, status: "new" });

    const { result } = renderHook(() => useJobMutations(), {
      wrapper: createWrapper(queryClient),
    });

    let deletedCount = 0;

    await act(async () => {
      deletedCount = await result.current.deleteByStatus("new");
    });

    expect(deletedCount).toBe(3);
    expect(mockPost).toHaveBeenCalledWith("/jobs/batch/delete", { status: "new" });
  });

  it("keeps clearError stable across rerenders", () => {
    const queryClient = createQueryClient();
    const { result, rerender } = renderHook(() => useJobMutations(), {
      wrapper: createWrapper(queryClient),
    });

    const initialClearError = result.current.clearError;
    rerender();

    expect(result.current.clearError).toBe(initialClearError);
  });
});
