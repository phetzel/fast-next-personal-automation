"use client";

import { useMemo } from "react";
import { useJobsListQuery } from "@/hooks/queries/jobs";
import { Combobox } from "@/components/shared/forms";
import { Label } from "@/components/ui";
import { AlertTriangle, Briefcase, Loader2 } from "lucide-react";
import type { Job } from "@/types";
import { ScoreBadge } from "@/components/shared/jobs/score-badge";
import { StatusBadge } from "@/components/shared/jobs/status-badge";

interface JobSelectFieldProps {
  id: string;
  value: unknown;
  onChange: (value: string | undefined) => void;
  required?: boolean;
  description?: string;
  /** Optional filter to only show jobs with certain statuses */
  statusFilter?: string[];
}

const UNSET_JOB_VALUE = "__unselected__";

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
  const jobsQuery = useJobsListQuery({
    page: 1,
    page_size: 100,
    sort_by: "created_at",
    sort_order: "desc",
  });
  const jobs = useMemo(() => {
    const allJobs = jobsQuery.data?.jobs ?? [];

    if (!statusFilter || statusFilter.length === 0) {
      return allJobs;
    }

    return allJobs.filter((job) => statusFilter.includes(job.status));
  }, [jobsQuery.data?.jobs, statusFilter]);
  const isLoading = jobsQuery.isLoading || jobsQuery.isFetching;
  const error = jobsQuery.error instanceof Error ? jobsQuery.error.message : null;

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
                  ? "No jobs match the required status yet."
                  : "Add or ingest jobs first, then come back to prep."}
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
  const selectedValue = typeof value === "string" && value ? value : UNSET_JOB_VALUE;

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="flex items-center gap-1">
        Job
        {required && <span className="text-destructive">*</span>}
      </Label>
      <Combobox
        triggerId={id}
        value={selectedValue}
        onValueChange={(nextValue) =>
          onChange(nextValue === UNSET_JOB_VALUE ? undefined : nextValue)
        }
        options={[
          { value: UNSET_JOB_VALUE, label: "Select a job..." },
          ...jobs.map((job) => ({
            value: job.id,
            label: `${job.title} @ ${job.company}`,
            keywords: [job.title, job.company, job.location ?? "", job.status],
          })),
        ]}
        placeholder="Select a job..."
        searchPlaceholder="Search jobs..."
        renderOption={(option) => {
          const job = jobs.find((item) => item.id === option.value);

          if (!job) {
            return option.label;
          }

          return (
            <div className="flex min-w-0 flex-col">
              <span className="truncate">{job.title}</span>
              <span className="text-muted-foreground truncate text-xs">
                {job.company}
                {job.location ? ` · ${job.location}` : ""}
              </span>
            </div>
          );
        }}
      />

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
