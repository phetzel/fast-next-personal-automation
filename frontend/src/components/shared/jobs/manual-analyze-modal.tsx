"use client";

import { useEffect, useMemo, useState } from "react";
import { useJobMutations } from "@/hooks";
import { getScreeningQuestionText, type Job } from "@/types";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Label,
  Switch,
  Textarea,
} from "@/components/ui";
import { CheckCircle, ClipboardCheck, Loader2 } from "lucide-react";

interface ManualAnalyzeModalProps {
  job: Job | null;
  isOpen: boolean;
  onClose: () => void;
  onComplete?: (updatedJob: Job) => void;
}

interface ManualAnalyzeFormState {
  requiresCoverLetter: boolean;
  screeningQuestionsText: string;
}

function toInitialState(job: Job | null): ManualAnalyzeFormState {
  return {
    requiresCoverLetter: job?.requires_cover_letter ?? false,
    screeningQuestionsText: (job?.screening_questions ?? [])
      .map(getScreeningQuestionText)
      .filter(Boolean)
      .join("\n"),
  };
}

export function ManualAnalyzeModal({ job, isOpen, onClose, onComplete }: ManualAnalyzeModalProps) {
  const { manualAnalyzeJob, error, clearError } = useJobMutations();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<ManualAnalyzeFormState>(toInitialState(job));
  const questionCount = useMemo(
    () =>
      form.screeningQuestionsText
        .split("\n")
        .map((value) => value.trim())
        .filter(Boolean).length,
    [form.screeningQuestionsText]
  );

  useEffect(() => {
    if (isOpen) {
      setForm(toInitialState(job));
      setIsSubmitting(false);
      clearError();
    }
  }, [clearError, isOpen, job]);

  if (!job) {
    return null;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    const updatedJob = await manualAnalyzeJob(job.id, {
      requires_cover_letter: form.requiresCoverLetter,
      screening_questions: form.screeningQuestionsText
        .split("\n")
        .map((value) => value.trim())
        .filter(Boolean),
    });

    setIsSubmitting(false);
    if (updatedJob) {
      onComplete?.(updatedJob);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Manual Analyze
          </DialogTitle>
          <DialogDescription>
            Capture prep requirements for this job without waiting on external analysis. Cover
            letters stay off unless you enable them here.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="bg-muted/20 rounded-lg border p-4 text-sm">
            <p className="font-medium">{job.title}</p>
            <p className="text-muted-foreground">{job.company}</p>
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
            <div className="space-y-1">
              <Label htmlFor="requires-cover-letter" className="text-sm font-medium">
                Cover letter required
              </Label>
              <p className="text-muted-foreground text-xs">
                Leave this off for quick analyze when you only want prep notes and question answers.
              </p>
            </div>
            <Switch
              id="requires-cover-letter"
              checked={form.requiresCoverLetter}
              onCheckedChange={(checked) =>
                setForm((current) => ({ ...current, requiresCoverLetter: checked }))
              }
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="screening-questions">Custom Questions to Prep</Label>
            <Textarea
              id="screening-questions"
              value={form.screeningQuestionsText}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  screeningQuestionsText: event.target.value,
                }))
              }
              placeholder={
                "Enter one question per line.\nWhy do you want to work here?\nDescribe your experience with FastAPI."
              }
              rows={8}
              disabled={isSubmitting}
            />
            <p className="text-muted-foreground text-xs">
              One question per line. Prep will generate answers for {questionCount} question
              {questionCount === 1 ? "" : "s"}.
            </p>
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex items-center justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  {job.status === "new" ? "Mark Ready for Prep" : "Save Analysis"}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
