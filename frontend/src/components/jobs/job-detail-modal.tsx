"use client";

import { useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Textarea,
} from "@/components/ui";
import type { Job, JobStatus, JobUpdate } from "@/types";
import { ScoreBadge } from "./score-badge";
import {
  Building2,
  MapPin,
  Calendar,
  ExternalLink,
  Loader2,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";

interface JobDetailModalProps {
  job: Job | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (jobId: string, update: JobUpdate) => Promise<Job | null>;
  onDelete: (jobId: string) => Promise<boolean>;
}

const STATUS_OPTIONS: { value: JobStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "reviewed", label: "Reviewed" },
  { value: "applied", label: "Applied" },
  { value: "interviewing", label: "Interviewing" },
  { value: "rejected", label: "Rejected" },
];

export function JobDetailModal({
  job,
  isOpen,
  onClose,
  onUpdate,
  onDelete,
}: JobDetailModalProps) {
  const [notes, setNotes] = useState(job?.notes || "");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Update notes when job changes
  if (job && notes !== (job.notes || "") && !isUpdating) {
    setNotes(job.notes || "");
  }

  if (!job) return null;

  const handleStatusChange = async (status: JobStatus) => {
    setIsUpdating(true);
    await onUpdate(job.id, { status });
    setIsUpdating(false);
  };

  const handleSaveNotes = async () => {
    setIsUpdating(true);
    await onUpdate(job.id, { notes });
    setIsUpdating(false);
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this job?")) return;
    setIsDeleting(true);
    const success = await onDelete(job.id);
    setIsDeleting(false);
    if (success) {
      onClose();
    }
  };

  const postedDate = job.date_posted
    ? format(new Date(job.date_posted), "MMM d, yyyy")
    : null;

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-xl">{job.title}</DialogTitle>
              <DialogDescription className="mt-1 flex items-center gap-1.5">
                <Building2 className="h-4 w-4" />
                {job.company}
              </DialogDescription>
            </div>
            <ScoreBadge score={job.relevance_score} className="shrink-0" />
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Meta info */}
          <div className="text-muted-foreground flex flex-wrap gap-4 text-sm">
            {job.location && (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {job.location}
              </div>
            )}
            {postedDate && (
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                Posted {postedDate}
              </div>
            )}
            {job.source && (
              <span className="capitalize">Source: {job.source}</span>
            )}
          </div>

          {/* Salary */}
          {job.salary_range && (
            <p className="text-lg font-semibold text-green-600">
              {job.salary_range}
            </p>
          )}

          {/* Status selector */}
          <div>
            <p className="mb-2 text-sm font-medium">Status</p>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  variant={job.status === option.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleStatusChange(option.value)}
                  disabled={isUpdating}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          {/* AI Reasoning */}
          {job.reasoning && (
            <div>
              <p className="mb-2 text-sm font-medium">AI Analysis</p>
              <p className="bg-muted rounded-lg p-3 text-sm">{job.reasoning}</p>
            </div>
          )}

          {/* Description */}
          {job.description && (
            <div>
              <p className="mb-2 text-sm font-medium">Description</p>
              <div className="bg-muted max-h-60 overflow-y-auto rounded-lg p-3">
                <p className="whitespace-pre-wrap text-sm">{job.description}</p>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <p className="mb-2 text-sm font-medium">Your Notes</p>
            <Textarea
              value={notes}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
              placeholder="Add notes about this job..."
              rows={3}
            />
            {notes !== (job.notes || "") && (
              <Button
                size="sm"
                onClick={handleSaveNotes}
                disabled={isUpdating}
                className="mt-2"
              >
                {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Notes
              </Button>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between border-t pt-4">
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete
            </Button>
            <Button asChild>
              <a
                href={job.job_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                View Job Posting
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

