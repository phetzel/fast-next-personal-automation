import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JobStatsCard } from "./job-stats-card";

describe("JobStatsCard", () => {
  it("groups lifecycle statuses into pre-applied and post-applied sections", () => {
    render(
      <JobStatsCard
        stats={{
          total: 12,
          new: 3,
          analyzed: 2,
          prepped: 1,
          reviewed: 1,
          applied: 3,
          interviewing: 1,
          rejected: 1,
          high_scoring: 4,
          avg_score: 81.3,
        }}
      />
    );

    expect(screen.getByText("Pre-Applied")).toBeInTheDocument();
    expect(screen.getByText("Post-Applied")).toBeInTheDocument();
    expect(screen.getByText("New")).toBeInTheDocument();
    expect(screen.getByText("Reviewed")).toBeInTheDocument();
    expect(screen.getByText("Applied")).toBeInTheDocument();
    expect(screen.getByText("Rejected")).toBeInTheDocument();
    expect(screen.getByText("High Score")).toBeInTheDocument();
    expect(screen.getByText("Avg Score")).toBeInTheDocument();
  });
});
