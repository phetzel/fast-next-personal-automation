"use client";

import { useEffect, useState, useCallback } from "react";
import { Label } from "@/components/ui";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api-client";
import { AlertTriangle, Briefcase, ChevronDown, Loader2 } from "lucide-react";
import type { Job, JobListResponse } from "@/types";
import { ScoreBadge } from "@/components/jobs/score-badge";
import { StatusBadge } from "@/components/jobs/status-badge";

interface JobSelectFieldProps {
  id: string;
  value: unknown;
  onChange: (value: string | undefined) => void;
  required?: boolean;
  description?: string;
  /** Optional filter to only show jobs with certain statuses */
  statusFilter?: string[];
}

/**
 * A specialized select field for choosing a job from the user's job list.
 * Fetches jobs on mount and renders them with company and score info.
 */
export function JobSelectField({
  id,
  value,
  onChange,
  required,
  description,
  statusFilter,
}: JobSelectFieldProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch a reasonable number of recent jobs
      const params = new URLSearchParams();
      params.set("page_size", "100");
      params.set("sort_by", "created_at");
      params.set("sort_order", "desc");

      const response = await apiClient.get<JobListResponse>(`/jobs?${params.toString()}`);

      let filteredJobs = response.jobs;

      // Apply status filter if provided
      if (statusFilter && statusFilter.length > 0) {
        filteredJobs = filteredJobs.filter((job) => statusFilter.includes(job.status));
      }

      setJobs(filteredJobs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch jobs");
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  // Fetch jobs on mount
  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // No jobs - show message
  if (!isLoading && jobs.length === 0) {
    return (
      <div className="space-y-2">
        <Label htmlFor={id} className="flex items-center gap-1">
          Job
          {required && <span className="text-destructive">*</span>}
        </Label>
        <div className="border-muted-foreground/30 bg-muted/5 rounded-lg border-2 border-dashed p-4">
          <div className="flex items-start gap-3">
            <div className="bg-muted rounded-full p-2">
              <Briefcase className="text-muted-foreground h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-muted-foreground font-medium">No Jobs Found</p>
              <p className="text-muted-foreground mt-1 text-sm">
                {statusFilter
                  ? "No jobs match the required status. Try running a job search first."
                  : "Run a job search to find jobs, then come back to prep."}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-2">
        <Label htmlFor={id} className="flex items-center gap-1">
          Job
          {required && <span className="text-destructive">*</span>}
        </Label>
        <div className="bg-muted/50 flex h-10 w-full items-center gap-2 rounded-md border px-3">
          <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
          <span className="text-muted-foreground text-sm">Loading jobs...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-2">
        <Label htmlFor={id} className="flex items-center gap-1">
          Job
          {required && <span className="text-destructive">*</span>}
        </Label>
        <div className="border-destructive/50 bg-destructive/5 flex h-10 w-full items-center gap-2 rounded-md border px-3">
          <AlertTriangle className="text-destructive h-4 w-4" />
          <span className="text-destructive text-sm">{error}</span>
        </div>
      </div>
    );
  }

  // Find selected job for preview
  const selectedJob = jobs.find((j) => j.id === value);

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="flex items-center gap-1">
        Job
        {required && <span className="text-destructive">*</span>}
      </Label>
      <div className="relative">
        <select
          id={id}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value || undefined)}
          required={required}
          className={cn(
            "border-input bg-background ring-offset-background",
            "focus-visible:ring-ring flex h-10 w-full appearance-none rounded-md border py-2 pr-10 pl-3",
            "text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
            "disabled:cursor-not-allowed disabled:opacity-50"
          )}
        >
          <option value="">Select a job...</option>
          {jobs.map((job) => (
            <option key={job.id} value={job.id}>
              {job.title} @ {job.company}
              {job.relevance_score ? ` (${job.relevance_score.toFixed(1)})` : ""}
            </option>
          ))}
        </select>
        <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2" />
      </div>

      {/* Show selected job info */}
      {selectedJob && <SelectedJobInfo job={selectedJob} />}

      {/* Description */}
      {description && <p className="text-muted-foreground text-xs">{description}</p>}
    </div>
  );
}

/**
 * Shows details about the selected job.
 */
function SelectedJobInfo({ job }: { job: Job }) {
  return (
    <div className="bg-muted/30 space-y-2 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusBadge status={job.status} />
          <ScoreBadge score={job.relevance_score} />
        </div>
        {job.source && (
          <span className="text-muted-foreground text-xs capitalize">via {job.source}</span>
        )}
      </div>
      <div>
        <p className="text-sm font-medium">{job.title}</p>
        <p className="text-muted-foreground text-xs">
          {job.company}
          {job.location && ` • ${job.location}`}
        </p>
      </div>
      {job.reasoning && (
        <p className="text-muted-foreground line-clamp-2 text-xs">{job.reasoning}</p>
      )}
    </div>
  );
}
