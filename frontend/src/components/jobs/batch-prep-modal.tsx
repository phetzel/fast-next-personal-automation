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
  Input,
} from "@/components/ui";
import { usePipelines } from "@/hooks/use-pipelines";
import { cn } from "@/lib/utils";
import {
  Layers,
  Loader2,
  CheckCircle,
  XCircle,
  ChevronDown,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

interface BatchPrepModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

interface BatchPrepFormData {
  tone: "professional" | "conversational" | "enthusiastic";
  max_jobs: number;
}

interface PrepResult {
  job_id: string;
  job_title: string;
  company: string;
  success: boolean;
  profile_used?: string | null;
  error?: string;
}

/**
 * Modal for running the batch job prep pipeline.
 * Generates cover letters and prep notes for all NEW jobs.
 * Uses each job's associated profile (from job_search) or falls back to default.
 */
export function BatchPrepModal({
  isOpen,
  onClose,
  onComplete,
}: BatchPrepModalProps) {
  const { executePipeline, getExecutionState, resetExecution } = usePipelines();
  const [formData, setFormData] = useState<BatchPrepFormData>({
    tone: "professional",
    max_jobs: 20,
  });

  const execState = getExecutionState("job_prep_batch");
  const isRunning = execState.status === "running";
  const isComplete = execState.status === "success" || execState.status === "error";

  // Reset execution state when modal opens
  useEffect(() => {
    if (isOpen) {
      resetExecution("job_prep_batch");
    }
  }, [isOpen, resetExecution]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await executePipeline("job_prep_batch", {
      tone: formData.tone,
      max_jobs: formData.max_jobs,
    });
  };

  const handleClose = () => {
    if (execState.status === "success") {
      onComplete?.();
    }
    onClose();
  };

  const handleRunAgain = () => {
    resetExecution("job_prep_batch");
  };

  // Parse output if available
  const output = execState.result?.output as {
    total_processed?: number;
    successful?: number;
    failed?: number;
    skipped?: number;
    results?: PrepResult[];
  } | null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            Batch Prep Jobs
          </DialogTitle>
          <DialogDescription>
            Generate cover letters and prep notes for all NEW jobs. Each job
            will use the profile it was searched with.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tone selector */}
          <div className="space-y-2">
            <Label htmlFor="tone">Cover Letter Tone</Label>
            <div className="relative">
              <select
                id="tone"
                value={formData.tone}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    tone: e.target.value as BatchPrepFormData["tone"],
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
                <option value="professional">Professional</option>
                <option value="conversational">Conversational</option>
                <option value="enthusiastic">Enthusiastic</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          {/* Max jobs */}
          <div className="space-y-2">
            <Label htmlFor="max_jobs">Maximum Jobs to Prep</Label>
            <Input
              id="max_jobs"
              type="number"
              min={1}
              max={50}
              value={formData.max_jobs}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  max_jobs: Math.min(50, Math.max(1, parseInt(e.target.value) || 1)),
                }))
              }
              disabled={isRunning}
            />
            <p className="text-xs text-muted-foreground">
              Jobs are processed in order of highest relevance score first (1-50)
            </p>
          </div>

          {/* Execution result */}
          {isRunning && (
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                <div>
                  <p className="font-medium text-blue-600 dark:text-blue-400">
                    Generating materials...
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Processing jobs concurrently. This may take a few minutes.
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
                  Batch Prep Complete!
                </p>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="rounded-md bg-background/50 p-2">
                  <p className="text-xl font-bold">{output.total_processed || 0}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
                <div className="rounded-md bg-background/50 p-2">
                  <p className="text-xl font-bold text-green-600">{output.successful || 0}</p>
                  <p className="text-xs text-muted-foreground">Success</p>
                </div>
                <div className="rounded-md bg-background/50 p-2">
                  <p className="text-xl font-bold text-yellow-600">{output.skipped || 0}</p>
                  <p className="text-xs text-muted-foreground">Skipped</p>
                </div>
                <div className="rounded-md bg-background/50 p-2">
                  <p className="text-xl font-bold text-red-600">{output.failed || 0}</p>
                  <p className="text-xs text-muted-foreground">Failed</p>
                </div>
              </div>

              {/* Successful jobs with profiles */}
              {output.results && output.results.filter((r) => r.success && !r.error).length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-green-600 flex items-center gap-1">
                    <CheckCircle className="h-4 w-4" />
                    Prepped Jobs:
                  </p>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {output.results
                      .filter((r) => r.success && !r.error)
                      .map((result) => (
                        <div
                          key={result.job_id}
                          className="text-xs bg-background/50 rounded px-2 py-1 flex justify-between"
                        >
                          <span>
                            <span className="font-medium">{result.job_title}</span>
                            <span className="text-muted-foreground"> at {result.company}</span>
                          </span>
                          {result.profile_used && (
                            <span className="text-muted-foreground text-[10px]">
                              {result.profile_used}
                            </span>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Failed jobs list */}
              {output.results && output.results.filter((r) => !r.success).length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-red-600 flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    Failed Jobs:
                  </p>
                  <div className="max-h-24 overflow-y-auto space-y-1">
                    {output.results
                      .filter((r) => !r.success)
                      .map((result) => (
                        <div
                          key={result.job_id}
                          className="text-xs bg-background/50 rounded px-2 py-1"
                        >
                          <span className="font-medium">{result.job_title}</span>
                          <span className="text-muted-foreground"> at {result.company}</span>
                          {result.error && (
                            <p className="text-red-500 text-[10px] mt-0.5">{result.error}</p>
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
                <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                <div>
                  <p className="font-medium text-red-600 dark:text-red-400">
                    Batch Prep Failed
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
                  Run Again
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
                      Processing...
                    </>
                  ) : (
                    <>
                      <Layers className="mr-2 h-4 w-4" />
                      Prep All New Jobs
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
