"use client";

import { useState, useEffect } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Label,
} from "@/components/ui";
import { ProfileSelectField } from "@/components/pipelines/profile-select-field";
import { usePipelines } from "@/hooks/use-pipelines";
import { cn } from "@/lib/utils";
import {
  Search,
  Loader2,
  CheckCircle,
  XCircle,
  ChevronDown,
  ExternalLink,
  RefreshCw,
} from "lucide-react";

interface SearchJobsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

interface SearchFormData {
  profile_id?: string;
  scraper: "jobspy" | "mock";
}

/**
 * Modal for running the job search pipeline directly from the listings page.
 * Shows the form, executes the pipeline, and displays results inline.
 */
export function SearchJobsModal({
  isOpen,
  onClose,
  onComplete,
}: SearchJobsModalProps) {
  const { executePipeline, getExecutionState, resetExecution } = usePipelines();
  const [formData, setFormData] = useState<SearchFormData>({
    scraper: "jobspy",
  });

  const execState = getExecutionState("job_search");
  const isRunning = execState.status === "running";
  const isComplete = execState.status === "success" || execState.status === "error";

  // Reset execution state when modal opens
  useEffect(() => {
    if (isOpen) {
      resetExecution("job_search");
    }
  }, [isOpen, resetExecution]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await executePipeline("job_search", formData as unknown as Record<string, unknown>);
  };

  const handleClose = () => {
    if (execState.status === "success") {
      onComplete?.();
    }
    onClose();
  };

  const handleRunAgain = () => {
    resetExecution("job_search");
  };

  // Parse output if available
  const output = execState.result?.output as {
    total_scraped?: number;
    total_analyzed?: number;
    jobs_saved?: number;
    high_scoring?: number;
    duplicates_skipped?: number;
    top_jobs?: Array<{
      id: string;
      title: string;
      company: string;
      relevance_score: number;
      job_url: string;
    }>;
  } | null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search for Jobs
          </DialogTitle>
          <DialogDescription>
            Search job boards and analyze matches against your resume.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Profile selector */}
          <ProfileSelectField
            id="search-profile"
            value={formData.profile_id}
            onChange={(value) =>
              setFormData((prev) => ({ ...prev, profile_id: value }))
            }
            description="Uses target roles and locations from your profile"
          />

          {/* Scraper selector */}
          <div className="space-y-2">
            <Label htmlFor="scraper">Data Source</Label>
            <div className="relative">
              <select
                id="scraper"
                value={formData.scraper}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    scraper: e.target.value as "jobspy" | "mock",
                  }))
                }
                disabled={isRunning}
                className={cn(
                  "border-input bg-background ring-offset-background",
                  "focus-visible:ring-ring flex h-10 w-full appearance-none rounded-md border pl-3 pr-10 py-2",
                  "text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                  "disabled:cursor-not-allowed disabled:opacity-50"
                )}
              >
                <option value="jobspy">Real Jobs (LinkedIn, Indeed, etc.)</option>
                <option value="mock">Mock Data (Testing)</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          {/* Execution result */}
          {isRunning && (
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                <div>
                  <p className="font-medium text-blue-600 dark:text-blue-400">
                    Searching for jobs...
                  </p>
                  <p className="text-sm text-muted-foreground">
                    This may take a minute while we scrape and analyze jobs.
                  </p>
                </div>
              </div>
            </div>
          )}

          {execState.status === "success" && output && (
            <div className="space-y-3 rounded-lg border border-green-500/20 bg-green-500/5 p-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <p className="font-medium text-green-600 dark:text-green-400">
                  Search Complete!
                </p>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md bg-background/50 p-2">
                  <p className="text-2xl font-bold">{output.jobs_saved || 0}</p>
                  <p className="text-xs text-muted-foreground">Jobs Saved</p>
                </div>
                <div className="rounded-md bg-background/50 p-2">
                  <p className="text-2xl font-bold">{output.high_scoring || 0}</p>
                  <p className="text-xs text-muted-foreground">High Matches</p>
                </div>
                <div className="rounded-md bg-background/50 p-2">
                  <p className="text-2xl font-bold">{output.duplicates_skipped || 0}</p>
                  <p className="text-xs text-muted-foreground">Duplicates</p>
                </div>
              </div>

              {/* Top jobs preview */}
              {output.top_jobs && output.top_jobs.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Top Matches:</p>
                  <div className="space-y-1.5">
                    {output.top_jobs.slice(0, 3).map((job) => (
                      <div
                        key={job.id}
                        className="flex items-center justify-between rounded-md bg-background/50 px-3 py-2 text-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{job.title}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {job.company}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-green-500/10 px-1.5 py-0.5 text-xs font-medium text-green-600">
                            {job.relevance_score?.toFixed(1)}
                          </span>
                          <a
                            href={job.job_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {execState.status === "error" && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
              <div className="flex items-start gap-2">
                <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                <div>
                  <p className="font-medium text-red-600 dark:text-red-400">
                    Search Failed
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {execState.result?.error || "An unexpected error occurred"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 border-t pt-4">
            {isComplete ? (
              <>
                <Button type="button" variant="outline" onClick={handleRunAgain}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Search Again
                </Button>
                <Button type="button" onClick={handleClose}>
                  {execState.status === "success" ? "View Jobs" : "Close"}
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={isRunning}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isRunning}>
                  {isRunning ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      Start Search
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

