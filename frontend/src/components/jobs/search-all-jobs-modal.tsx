"use client";

import { useState, useEffect } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui";
import { usePipelines } from "@/hooks/use-pipelines";
import {
  Globe,
  Loader2,
  CheckCircle,
  XCircle,
  RefreshCw,
  AlertCircle,
  ChevronDown,
} from "lucide-react";
import { Label } from "@/components/ui";
import { cn } from "@/lib/utils";

interface SearchAllJobsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

interface ProfileSearchResult {
  profile_id: string;
  profile_name: string;
  success: boolean;
  jobs_saved: number;
  high_scoring: number;
  error?: string | null;
}

interface BatchSearchFormData {
  hours_old: number;
}

const RECENCY_OPTIONS = [
  { value: 24, label: "Last 24 Hours" },
  { value: 48, label: "Last 48 Hours" },
  { value: 72, label: "Last 3 Days" },
  { value: 168, label: "Last Week" },
  { value: 336, label: "Last 2 Weeks" },
];

/**
 * Modal for running the batch job search pipeline.
 * Searches for jobs across all of the user's job profiles.
 */
export function SearchAllJobsModal({ isOpen, onClose, onComplete }: SearchAllJobsModalProps) {
  const { executePipeline, getExecutionState, resetExecution } = usePipelines();
  const [hasStarted, setHasStarted] = useState(false);
  const [formData, setFormData] = useState<BatchSearchFormData>({
    hours_old: 72,
  });

  const execState = getExecutionState("job_search_batch");
  const isRunning = execState.status === "running";
  const isComplete = execState.status === "success" || execState.status === "error";

  // Reset execution state when modal opens
  useEffect(() => {
    if (isOpen) {
      resetExecution("job_search_batch");
      setHasStarted(false);
    }
  }, [isOpen, resetExecution]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setHasStarted(true);
    await executePipeline("job_search_batch", formData as unknown as Record<string, unknown>);
  };

  const handleClose = () => {
    if (execState.status === "success") {
      onComplete?.();
    }
    onClose();
  };

  const handleRunAgain = () => {
    resetExecution("job_search_batch");
    setHasStarted(false);
  };

  // Parse output if available
  const output = execState.result?.output as {
    total_profiles?: number;
    successful?: number;
    failed?: number;
    total_jobs_saved?: number;
    total_high_scoring?: number;
    results?: ProfileSearchResult[];
  } | null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="text-primary h-5 w-5" />
            Search All Profiles
          </DialogTitle>
          <DialogDescription>
            Run job search for all of your profiles at once. Each profile with a resume will be
            searched.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Pre-run form */}
          {!hasStarted && (
            <div className="space-y-4">
              <div className="border-muted bg-muted/30 rounded-lg border p-4 text-sm">
                <p className="text-muted-foreground">
                  This will search for jobs using all your profiles that have resumes attached. Each
                  profile&apos;s target roles and locations will be used for its search.
                </p>
              </div>

              {/* Recency selector */}
              <div className="space-y-2">
                <Label htmlFor="batch-hours-old">Posted Within</Label>
                <div className="relative">
                  <select
                    id="batch-hours-old"
                    value={formData.hours_old}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        hours_old: parseInt(e.target.value, 10),
                      }))
                    }
                    className={cn(
                      "border-input bg-background ring-offset-background",
                      "focus-visible:ring-ring flex h-10 w-full appearance-none rounded-md border py-2 pr-10 pl-3",
                      "text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    )}
                  >
                    {RECENCY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2" />
                </div>
                <p className="text-muted-foreground text-xs">
                  Only scrape jobs posted within this time frame
                </p>
              </div>
            </div>
          )}

          {/* Execution result */}
          {isRunning && (
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                <div>
                  <p className="font-medium text-blue-600 dark:text-blue-400">
                    Searching across profiles...
                  </p>
                  <p className="text-muted-foreground text-sm">
                    This may take a few minutes depending on how many profiles you have.
                  </p>
                </div>
              </div>
            </div>
          )}

          {execState.status === "success" && output && (
            <div className="space-y-3 rounded-lg border border-green-500/20 bg-green-500/5 p-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <p className="font-medium text-green-600 dark:text-green-400">Search Complete!</p>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-background/50 rounded-md p-2">
                  <p className="text-xl font-bold">{output.total_profiles || 0}</p>
                  <p className="text-muted-foreground text-xs">Profiles</p>
                </div>
                <div className="bg-background/50 rounded-md p-2">
                  <p className="text-xl font-bold text-green-600">{output.total_jobs_saved || 0}</p>
                  <p className="text-muted-foreground text-xs">Jobs Saved</p>
                </div>
                <div className="bg-background/50 rounded-md p-2">
                  <p className="text-xl font-bold text-amber-600">
                    {output.total_high_scoring || 0}
                  </p>
                  <p className="text-muted-foreground text-xs">High Score</p>
                </div>
              </div>

              {/* Per-profile results */}
              {output.results && output.results.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-sm font-medium">Profile Results:</p>
                  <div className="max-h-40 space-y-1 overflow-y-auto">
                    {output.results.map((result) => (
                      <div
                        key={result.profile_id}
                        className="bg-background/50 flex items-center justify-between rounded px-2 py-1.5 text-xs"
                      >
                        <span className="flex items-center gap-1.5">
                          {result.success ? (
                            <CheckCircle className="h-3 w-3 text-green-500" />
                          ) : (
                            <XCircle className="h-3 w-3 text-red-500" />
                          )}
                          <span className="font-medium">{result.profile_name}</span>
                        </span>
                        {result.success ? (
                          <span className="text-muted-foreground">
                            {result.jobs_saved} jobs ({result.high_scoring} high)
                          </span>
                        ) : (
                          <span className="text-[10px] text-red-500">{result.error}</span>
                        )}
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
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                <div>
                  <p className="font-medium text-red-600 dark:text-red-400">Search Failed</p>
                  <p className="text-muted-foreground mt-1 text-sm">
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
                <Button type="button" variant="outline" onClick={handleClose} disabled={isRunning}>
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
                      <Globe className="mr-2 h-4 w-4" />
                      Search All Profiles
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
