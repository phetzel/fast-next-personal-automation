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
import type { Job } from "@/types";
import {
  FileText,
  Loader2,
  CheckCircle,
  XCircle,
  ChevronDown,
  RefreshCw,
  Sparkles,
  Building2,
} from "lucide-react";

interface PrepJobModalProps {
  job: Job | null;
  isOpen: boolean;
  onClose: () => void;
  onComplete?: (updatedJob?: Job) => void;
}

interface PrepFormData {
  job_id: string;
  profile_id?: string;
  tone: "professional" | "conversational" | "enthusiastic";
}

/**
 * Modal for running the job prep pipeline directly from the listings page.
 * Generates cover letter and prep notes for a specific job.
 */
export function PrepJobModal({ job, isOpen, onClose, onComplete }: PrepJobModalProps) {
  const { executePipeline, getExecutionState, resetExecution } = usePipelines();
  const [formData, setFormData] = useState<PrepFormData>({
    job_id: "",
    tone: "professional",
  });

  const execState = getExecutionState("job_prep");
  const isRunning = execState.status === "running";
  const isComplete = execState.status === "success" || execState.status === "error";

  // Update job_id when job changes
  useEffect(() => {
    if (job) {
      setFormData((prev) => ({ ...prev, job_id: job.id }));
    }
  }, [job]);

  // Reset execution state when modal opens
  useEffect(() => {
    if (isOpen) {
      resetExecution("job_prep");
    }
  }, [isOpen, resetExecution]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!job) return;
    await executePipeline("job_prep", formData as unknown as Record<string, unknown>);
  };

  const handleClose = () => {
    if (execState.status === "success") {
      onComplete?.();
    }
    onClose();
  };

  const handleRunAgain = () => {
    resetExecution("job_prep");
  };

  // Parse output if available
  const output = execState.result?.output as {
    job_id?: string;
    job_title?: string;
    company?: string;
    cover_letter?: string;
    prep_notes?: string;
    profile_used?: string;
    included_story?: boolean;
    included_projects?: number;
  } | null;

  if (!job) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="text-primary h-5 w-5" />
            Prepare Application Materials
          </DialogTitle>
          <DialogDescription asChild>
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4" />
              <span className="font-medium">{job.title}</span>
              <span className="text-muted-foreground">at {job.company}</span>
            </div>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Profile selector */}
          <ProfileSelectField
            id="prep-profile"
            value={formData.profile_id}
            onChange={(value) => setFormData((prev) => ({ ...prev, profile_id: value }))}
            description="Uses resume, story, and projects from your profile"
          />

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
                    tone: e.target.value as PrepFormData["tone"],
                  }))
                }
                disabled={isRunning}
                className={cn(
                  "border-input bg-background ring-offset-background",
                  "focus-visible:ring-ring flex h-10 w-full appearance-none rounded-md border py-2 pr-10 pl-3",
                  "text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                  "disabled:cursor-not-allowed disabled:opacity-50"
                )}
              >
                <option value="professional">Professional</option>
                <option value="conversational">Conversational</option>
                <option value="enthusiastic">Enthusiastic</option>
              </select>
              <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2" />
            </div>
            <p className="text-muted-foreground text-xs">
              Sets the overall tone of the generated cover letter
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
                  <p className="text-muted-foreground text-sm">
                    AI is crafting your cover letter and prep notes.
                  </p>
                </div>
              </div>
            </div>
          )}

          {execState.status === "success" && output && (
            <div className="space-y-4 rounded-lg border border-green-500/20 bg-green-500/5 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <p className="font-medium text-green-600 dark:text-green-400">Materials Ready!</p>
                </div>
                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                  <span>Profile: {output.profile_used}</span>
                  {output.included_story && (
                    <span className="rounded bg-purple-500/10 px-1.5 py-0.5 text-purple-600">
                      +Story
                    </span>
                  )}
                  {(output.included_projects ?? 0) > 0 && (
                    <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-blue-600">
                      +{output.included_projects} Projects
                    </span>
                  )}
                </div>
              </div>

              {/* Cover letter preview */}
              {output.cover_letter && (
                <div className="space-y-2">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <FileText className="h-4 w-4" />
                    Cover Letter Preview
                  </p>
                  <div className="bg-background/80 max-h-48 overflow-y-auto rounded-md p-3 text-sm">
                    <p className="line-clamp-[10] whitespace-pre-wrap">{output.cover_letter}</p>
                  </div>
                </div>
              )}

              {/* Prep notes preview */}
              {output.prep_notes && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Prep Notes Preview</p>
                  <div className="bg-background/80 max-h-32 overflow-y-auto rounded-md p-3 text-sm">
                    <p className="line-clamp-6 whitespace-pre-wrap">{output.prep_notes}</p>
                  </div>
                </div>
              )}

              <p className="text-muted-foreground text-xs">
                Click the job in the list to view full materials and edit the cover letter.
              </p>
            </div>
          )}

          {execState.status === "error" && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
              <div className="flex items-start gap-2">
                <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                <div>
                  <p className="font-medium text-red-600 dark:text-red-400">Prep Failed</p>
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
                  Regenerate
                </Button>
                <Button type="button" onClick={handleClose}>
                  {execState.status === "success" ? "View Job Details" : "Close"}
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
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate Materials
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
