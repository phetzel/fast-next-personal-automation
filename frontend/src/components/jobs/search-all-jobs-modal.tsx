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
} from "lucide-react";

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

/**
 * Modal for running the batch job search pipeline.
 * Searches for jobs across all of the user's job profiles.
 */
export function SearchAllJobsModal({
  isOpen,
  onClose,
  onComplete,
}: SearchAllJobsModalProps) {
  const { executePipeline, getExecutionState, resetExecution } = usePipelines();
  const [hasStarted, setHasStarted] = useState(false);

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
    await executePipeline("job_search_batch", {});
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Search All Profiles
          </DialogTitle>
          <DialogDescription>
            Run job search for all of your profiles at once. Each profile with a 
            resume will be searched.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Pre-run explanation */}
          {!hasStarted && (
            <div className="rounded-lg border border-muted bg-muted/30 p-4 text-sm">
              <p className="text-muted-foreground">
                This will search for jobs using all your profiles that have resumes attached.
                Each profile&apos;s target roles and locations will be used for its search.
              </p>
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
                  <p className="text-sm text-muted-foreground">
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
                <p className="font-medium text-green-600 dark:text-green-400">
                  Search Complete!
                </p>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md bg-background/50 p-2">
                  <p className="text-xl font-bold">{output.total_profiles || 0}</p>
                  <p className="text-xs text-muted-foreground">Profiles</p>
                </div>
                <div className="rounded-md bg-background/50 p-2">
                  <p className="text-xl font-bold text-green-600">{output.total_jobs_saved || 0}</p>
                  <p className="text-xs text-muted-foreground">Jobs Saved</p>
                </div>
                <div className="rounded-md bg-background/50 p-2">
                  <p className="text-xl font-bold text-amber-600">{output.total_high_scoring || 0}</p>
                  <p className="text-xs text-muted-foreground">High Score</p>
                </div>
              </div>

              {/* Per-profile results */}
              {output.results && output.results.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-sm font-medium">Profile Results:</p>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {output.results.map((result) => (
                      <div
                        key={result.profile_id}
                        className="text-xs bg-background/50 rounded px-2 py-1.5 flex justify-between items-center"
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
                          <span className="text-red-500 text-[10px]">
                            {result.error}
                          </span>
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

