import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { JobSelectField } from "./job-select-field";
import { apiClient } from "@/lib/api-client";

vi.mock("@/lib/api-client", () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

const mockGet = vi.mocked(apiClient.get);

describe("JobSelectField", () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it("renders an empty state when no jobs are returned", async () => {
    mockGet.mockResolvedValueOnce({
      jobs: [],
      total: 0,
      page: 1,
      page_size: 100,
      has_more: false,
    });

    render(<JobSelectField id="job" value={undefined} onChange={vi.fn()} />);

    expect(await screen.findByText("No Jobs Found")).toBeInTheDocument();
  });

  it("shows selected job details after loading options", async () => {
    mockGet.mockResolvedValueOnce({
      jobs: [
        {
          id: "job-1",
          title: "Frontend Engineer",
          company: "Acme",
          location: "Remote",
          relevance_score: 92,
          status: "analyzed",
          source: "linkedin",
          reasoning: "Strong TypeScript match",
        },
      ],
      total: 1,
      page: 1,
      page_size: 100,
      has_more: false,
    });

    render(<JobSelectField id="job" value="job-1" onChange={vi.fn()} />);

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalled();
    });

    expect(await screen.findByText("Frontend Engineer")).toBeInTheDocument();
    expect(screen.getAllByText(/Acme/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Strong TypeScript match/)).toBeInTheDocument();
  });
});
