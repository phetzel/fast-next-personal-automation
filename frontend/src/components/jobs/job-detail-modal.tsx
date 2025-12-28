"use client";

import { useState, useEffect } from "react";
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
import { JOB_STATUSES, JOB_STATUS_CONFIG, canTransitionTo } from "@/types";
import { ScoreBadge } from "./score-badge";
import { StatusBadge } from "./status-badge";
import { apiClient } from "@/lib/api-client";
import {
  Building2,
  MapPin,
  Calendar,
  ExternalLink,
  Loader2,
  Trash2,
  FileText,
  Download,
  CheckCircle,
  Save,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Sparkles,
  Eye,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface JobDetailModalProps {
  job: Job | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (jobId: string, update: JobUpdate) => Promise<Job | null>;
  onDelete: (jobId: string) => Promise<boolean>;
  onPrep?: (job: Job) => void;
}

// Generate status options from the shared constant
const STATUS_OPTIONS = JOB_STATUSES.map((status) => ({
  value: status,
  label: JOB_STATUS_CONFIG[status].label,
  description: JOB_STATUS_CONFIG[status].description,
}));

export function JobDetailModal({
  job,
  isOpen,
  onClose,
  onUpdate,
  onDelete,
  onPrep,
}: JobDetailModalProps) {
  const [notes, setNotes] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showPrepNotes, setShowPrepNotes] = useState(false);
  const [coverLetterDirty, setCoverLetterDirty] = useState(false);
  const [notesDirty, setNotesDirty] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Sync state when job changes
  useEffect(() => {
    if (job) {
      setNotes(job.notes || "");
      setCoverLetter(job.cover_letter || "");
      setCoverLetterDirty(false);
      setNotesDirty(false);
      setPdfError(null);
    }
  }, [job]);

  if (!job) return null;

  const handleStatusChange = async (newStatus: JobStatus) => {
    // Special handling for transitioning to "reviewed" - generates PDF
    if (newStatus === "reviewed" && job.status === "prepped") {
      await handleMarkAsReviewed();
      return;
    }

    setIsUpdating(true);
    await onUpdate(job.id, { status: newStatus });
    setIsUpdating(false);
  };

  const handleSaveNotes = async () => {
    setIsUpdating(true);
    await onUpdate(job.id, { notes });
    setNotesDirty(false);
    setIsUpdating(false);
  };

  const handleSaveCoverLetter = async () => {
    setIsUpdating(true);
    await onUpdate(job.id, { cover_letter: coverLetter });
    setCoverLetterDirty(false);
    setIsUpdating(false);
  };

  const handleMarkAsReviewed = async () => {
    // Save any pending cover letter changes first
    if (coverLetterDirty) {
      await onUpdate(job.id, { cover_letter: coverLetter });
      setCoverLetterDirty(false);
    }

    // Generate PDF
    setIsGeneratingPdf(true);
    setPdfError(null);
    
    try {
      const updatedJob = await apiClient.post<Job>(
        `/jobs/${job.id}/cover-letter/generate-pdf`
      );
      
      // Update status to reviewed
      await onUpdate(job.id, { status: "reviewed" });
      
      // Refresh the job in state with the new PDF path
      if (updatedJob) {
        await onUpdate(job.id, {}); // Trigger a refresh
      }
    } catch (error) {
      setPdfError(
        error instanceof Error ? error.message : "Failed to generate PDF"
      );
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch(`/api/jobs/${job.id}/cover-letter/download`);
      if (!response.ok) {
        throw new Error("Failed to download PDF");
      }
      
      const blob = await response.blob();
      const filename = response.headers.get("Content-Disposition")
        ?.match(/filename="(.+)"/)?.[1] || "cover-letter.pdf";
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Download failed:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePreviewPdf = () => {
    // Open preview in new tab
    window.open(`/api/jobs/${job.id}/cover-letter/preview`, "_blank");
  };

  const handleRegeneratePdf = async () => {
    // Save any pending cover letter changes first
    if (coverLetterDirty) {
      await onUpdate(job.id, { cover_letter: coverLetter });
      setCoverLetterDirty(false);
    }

    setIsGeneratingPdf(true);
    setPdfError(null);

    try {
      const updatedJob = await apiClient.post<Job>(
        `/jobs/${job.id}/cover-letter/generate-pdf`
      );

      // Refresh the job in state with the new PDF path
      if (updatedJob) {
        await onUpdate(job.id, {}); // Trigger a refresh
      }
    } catch (error) {
      setPdfError(
        error instanceof Error ? error.message : "Failed to regenerate PDF"
      );
    } finally {
      setIsGeneratingPdf(false);
    }
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

  const hasPreppedMaterials = !!job.cover_letter || !!job.prep_notes;
  const canGeneratePdf = job.cover_letter && !job.cover_letter_file_path;
  const hasPdf = !!job.cover_letter_file_path;

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-xl">{job.title}</DialogTitle>
              <DialogDescription className="mt-1 flex items-center gap-1.5">
                <Building2 className="h-4 w-4" />
                {job.company}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={job.status} />
              <ScoreBadge score={job.relevance_score} className="shrink-0" />
            </div>
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
            {job.prepped_at && (
              <span className="text-cyan-600 dark:text-cyan-400">
                Prepped {format(new Date(job.prepped_at), "MMM d")}
              </span>
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
              {STATUS_OPTIONS.map((option) => {
                const isCurrentStatus = job.status === option.value;
                const canTransition = canTransitionTo(job.status, option.value);
                const isReviewedTransition = 
                  option.value === "reviewed" && 
                  job.status === "prepped";
                
                return (
                  <Button
                    key={option.value}
                    variant={isCurrentStatus ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleStatusChange(option.value)}
                    disabled={isUpdating || isGeneratingPdf || (!isCurrentStatus && !canTransition)}
                    title={option.description}
                    className={cn(
                      !isCurrentStatus && !canTransition && "opacity-40 cursor-not-allowed",
                      isReviewedTransition && canTransition && "border-purple-500/50 hover:bg-purple-500/10"
                    )}
                  >
                    {isGeneratingPdf && option.value === "reviewed" ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : null}
                    {option.label}
                  </Button>
                );
              })}
            </div>
            {job.status === "prepped" && (
              <p className="mt-2 text-xs text-muted-foreground">
                <span className="text-purple-600 dark:text-purple-400">Tip:</span> Clicking &quot;Reviewed&quot; will generate a PDF of your cover letter.
              </p>
            )}
          </div>

          {/* PDF Error */}
          {pdfError && (
            <div className="rounded-md border border-red-500/20 bg-red-500/5 p-3">
              <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                <AlertCircle className="h-4 w-4" />
                <span>{pdfError}</span>
              </div>
            </div>
          )}

          {/* Cover Letter Section - only show if we have one */}
          {hasPreppedMaterials && (
            <div className="space-y-4 rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-cyan-600" />
                  <span className="font-medium text-cyan-700 dark:text-cyan-300">
                    Application Materials
                  </span>
                </div>
                {hasPdf && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handlePreviewPdf}
                      className="border-cyan-500/30 hover:bg-cyan-500/10"
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Preview
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleDownloadPdf}
                      disabled={isDownloading}
                      className="border-cyan-500/30 hover:bg-cyan-500/10"
                    >
                      {isDownloading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="mr-2 h-4 w-4" />
                      )}
                      Download
                    </Button>
                  </div>
                )}
              </div>

              {/* Cover Letter Editor */}
              {job.cover_letter && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Cover Letter</label>
                    {coverLetterDirty && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleSaveCoverLetter}
                        disabled={isUpdating}
                        className="h-7 text-xs"
                      >
                        {isUpdating ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : (
                          <Save className="mr-1 h-3 w-3" />
                        )}
                        Save Changes
                      </Button>
                    )}
                  </div>
                  <Textarea
                    value={coverLetter}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                      setCoverLetter(e.target.value);
                      setCoverLetterDirty(e.target.value !== job.cover_letter);
                    }}
                    placeholder="Your cover letter..."
                    rows={8}
                    className="font-mono text-sm"
                  />
                </div>
              )}

              {/* Prep Notes (collapsible) */}
              {job.prep_notes && (
                <div className="space-y-2">
                  <button
                    onClick={() => setShowPrepNotes(!showPrepNotes)}
                    className="flex w-full items-center justify-between text-sm font-medium hover:text-cyan-600"
                  >
                    <span>Prep Notes & Talking Points</span>
                    {showPrepNotes ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                  {showPrepNotes && (
                    <div className="rounded-md bg-background/80 p-3 text-sm">
                      <pre className="whitespace-pre-wrap font-sans">
                        {job.prep_notes}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {/* PDF status and regenerate button */}
              {hasPdf && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                    <CheckCircle className="h-4 w-4" />
                    <span>PDF generated {job.cover_letter_generated_at ? format(new Date(job.cover_letter_generated_at), "MMM d, h:mm a") : ""}</span>
                  </div>
                  {coverLetterDirty && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleRegeneratePdf}
                      disabled={isGeneratingPdf}
                      className="h-7 text-xs border-amber-500/30 hover:bg-amber-500/10"
                    >
                      {isGeneratingPdf ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-1 h-3 w-3" />
                      )}
                      Regenerate PDF
                    </Button>
                  )}
                </div>
              )}
              
              {/* Show regenerate prompt if cover letter edited */}
              {hasPdf && coverLetterDirty && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Cover letter has been modified. Save changes and regenerate the PDF to update.
                </p>
              )}
            </div>
          )}

          {/* Show prompt to prep if job is new and no materials */}
          {job.status === "new" && !hasPreppedMaterials && onPrep && (
            <div className="rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-primary/10 p-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Ready to Prepare?</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Generate a tailored cover letter and prep notes for this job.
                  </p>
                  <Button
                    size="sm"
                    className="mt-3"
                    onClick={() => {
                      onClose();
                      onPrep(job);
                    }}
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Prepare Materials
                  </Button>
                </div>
              </div>
            </div>
          )}

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
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Your Notes</p>
              {notesDirty && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleSaveNotes}
                  disabled={isUpdating}
                  className="h-7 text-xs"
                >
                  {isUpdating ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Save className="mr-1 h-3 w-3" />
                  )}
                  Save
                </Button>
              )}
            </div>
            <Textarea
              value={notes}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                setNotes(e.target.value);
                setNotesDirty(e.target.value !== (job.notes || ""));
              }}
              placeholder="Add notes about this job..."
              rows={3}
            />
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
