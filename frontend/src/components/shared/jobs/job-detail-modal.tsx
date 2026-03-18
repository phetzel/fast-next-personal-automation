"use client";

import Link from "next/link";
import { format } from "date-fns";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Textarea,
} from "@/components/ui";
import { getScreeningQuestionText, type Job, type JobStatus, type JobUpdate } from "@/types";
import { JOB_STATUSES, JOB_STATUS_CONFIG, canTransitionTo, shouldGenerateReviewPdf } from "@/types";
import { cn } from "@/lib/utils";
import { ScoreBadge } from "./score-badge";
import { StatusBadge } from "./status-badge";
import { useJobDetail } from "./use-job-detail";
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
  AlertCircle,
  Sparkles,
  Eye,
  RefreshCw,
  Maximize2,
  ClipboardCheck,
  MessageSquare,
} from "lucide-react";

interface JobDetailModalProps {
  job: Job | null;
  isOpen: boolean;
  onClose: () => void;
  onJobChange?: (job: Job | null) => void;
  onUpdate: (jobId: string, update: JobUpdate) => Promise<Job | null>;
  onDelete: (jobId: string) => Promise<boolean>;
  onAnalyze?: (job: Job) => void;
  onPrep?: (job: Job) => void;
}

const STATUS_OPTIONS = JOB_STATUSES.map((status) => ({
  value: status,
  label: JOB_STATUS_CONFIG[status].label,
  description: JOB_STATUS_CONFIG[status].description,
}));

export function JobDetailModal({
  job,
  isOpen,
  onClose,
  onJobChange,
  onUpdate,
  onDelete,
  onAnalyze,
  onPrep,
}: JobDetailModalProps) {
  const detail = useJobDetail({
    initialJob: job,
    onDelete,
    onUpdate,
    onDeleteSuccess: onClose,
    onJobChange,
  });

  if (!detail.job) {
    return null;
  }

  const currentJob = detail.job;
  const postedDate = currentJob.date_posted
    ? format(new Date(currentJob.date_posted), "MMM d, yyyy")
    : null;

  const handleStatusChange = async (newStatus: JobStatus) => {
    if (newStatus === "prepped" && currentJob.status === "analyzed" && onPrep) {
      onClose();
      onPrep(currentJob);
      return;
    }

    if (newStatus === "reviewed" && currentJob.status === "prepped") {
      await detail.handleMarkAsReviewed();
      return;
    }

    await detail.handleStatusChange(newStatus);
  };
  const defaultSections = [
    "snapshot",
    detail.hasApplicationAnalysis ? "analysis" : null,
    detail.hasPreppedMaterials ? "materials" : null,
    "notes",
  ].filter((value): value is string => Boolean(value));

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-xl">{currentJob.title}</DialogTitle>
              <DialogDescription className="mt-1 flex items-center gap-1.5">
                <Building2 className="h-4 w-4" />
                {currentJob.company}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild className="shrink-0">
                <Link href={`/jobs/${currentJob.id}`} onClick={onClose}>
                  <Maximize2 className="mr-2 h-4 w-4" />
                  Full View
                </Link>
              </Button>
              <StatusBadge status={currentJob.status} />
              <ScoreBadge score={currentJob.relevance_score} className="shrink-0" />
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          <div className="text-muted-foreground flex flex-wrap gap-4 text-sm">
            {currentJob.location && (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {currentJob.location}
              </div>
            )}
            {postedDate && (
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                Posted {postedDate}
              </div>
            )}
            {currentJob.source && <span className="capitalize">Source: {currentJob.source}</span>}
            {currentJob.prepped_at && (
              <span className="text-cyan-600 dark:text-cyan-400">
                Prepped {format(new Date(currentJob.prepped_at), "MMM d")}
              </span>
            )}
          </div>

          {currentJob.salary_range && (
            <p className="text-lg font-semibold text-green-600">{currentJob.salary_range}</p>
          )}

          <div>
            <p className="mb-2 text-sm font-medium">Status</p>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((option) => {
                const isCurrentStatus = currentJob.status === option.value;
                const canTransition =
                  canTransitionTo(currentJob.status, option.value) &&
                  !(option.value === "prepped" && currentJob.status === "analyzed" && !onPrep);
                const isPrepTransition =
                  option.value === "prepped" && currentJob.status === "analyzed";
                const isReviewedTransition =
                  option.value === "reviewed" && currentJob.status === "prepped";

                return (
                  <Button
                    key={option.value}
                    variant={isCurrentStatus ? "default" : "outline"}
                    size="sm"
                    onClick={() => void handleStatusChange(option.value)}
                    disabled={
                      detail.isUpdating ||
                      detail.isGeneratingPdf ||
                      (!isCurrentStatus && !canTransition)
                    }
                    title={option.description}
                    className={cn(
                      !isCurrentStatus && !canTransition && "cursor-not-allowed opacity-40",
                      isPrepTransition &&
                        canTransition &&
                        "border-cyan-500/50 hover:bg-cyan-500/10",
                      isReviewedTransition &&
                        canTransition &&
                        "border-purple-500/50 hover:bg-purple-500/10"
                    )}
                  >
                    {detail.isGeneratingPdf && option.value === "reviewed" ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : null}
                    {option.label}
                  </Button>
                );
              })}
            </div>
            {currentJob.status === "new" && (
              <p className="text-muted-foreground mt-2 text-xs">
                <span className="text-blue-600 dark:text-blue-400">Next step:</span> Capture the
                application requirements, then run prep. If you already submitted it elsewhere,
                click &quot;Applied&quot; directly.
              </p>
            )}
            {currentJob.status === "analyzed" && (
              <p className="text-muted-foreground mt-2 text-xs">
                <span className="text-cyan-600 dark:text-cyan-400">Next step:</span> Click
                &quot;Prepped&quot; to generate the cover letter and screening answers, or jump
                straight to &quot;Applied&quot; if you already submitted.
              </p>
            )}
            {currentJob.status === "prepped" && (
              <p className="text-muted-foreground mt-2 text-xs">
                <span className="text-purple-600 dark:text-purple-400">Tip:</span> Clicking
                &quot;Reviewed&quot; or &quot;Applied&quot;{" "}
                {shouldGenerateReviewPdf(currentJob)
                  ? "is available now. Reviewed will generate a PDF of your cover letter."
                  : "is available now."}
              </p>
            )}
          </div>

          {currentJob.status === "new" && onAnalyze && (
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-blue-700 dark:text-blue-300">Ready for prep?</p>
                  <p className="text-sm text-blue-700/80 dark:text-blue-300/80">
                    Run Manual Analyze to mark whether a cover letter is needed and add any custom
                    questions you want prepped.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => onAnalyze?.(currentJob)}>
                  <ClipboardCheck className="mr-2 h-4 w-4" />
                  Manual Analyze
                </Button>
              </div>
            </div>
          )}

          {detail.pdfError && (
            <div className="rounded-md border border-red-500/20 bg-red-500/5 p-3">
              <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                <AlertCircle className="h-4 w-4" />
                <span>{detail.pdfError}</span>
              </div>
            </div>
          )}

          {detail.downloadError && (
            <div className="rounded-md border border-red-500/20 bg-red-500/5 p-3">
              <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                <AlertCircle className="h-4 w-4" />
                <span>{detail.downloadError}</span>
              </div>
            </div>
          )}

          {currentJob.status === "analyzed" && !detail.hasPreppedMaterials && onPrep && (
            <div className="border-primary/30 bg-primary/5 rounded-lg border-2 border-dashed p-4">
              <div className="flex items-start gap-3">
                <div className="bg-primary/10 rounded-full p-2">
                  <Sparkles className="text-primary h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Ready to Prepare?</p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Generate a tailored cover letter, prep notes, and screening answers for this
                    job.
                  </p>
                  <Button
                    size="sm"
                    className="mt-3"
                    onClick={() => {
                      onClose();
                      onPrep(currentJob);
                    }}
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Prepare Materials
                  </Button>
                </div>
              </div>
            </div>
          )}

          <Accordion
            type="multiple"
            defaultValue={defaultSections}
            className="rounded-lg border px-4"
          >
            <AccordionItem value="snapshot">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  <span>Job Snapshot</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <span className="text-muted-foreground">Company:</span> {currentJob.company}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Location:</span>{" "}
                    {currentJob.location || "Unknown"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Job type:</span>{" "}
                    {currentJob.job_type || "Unknown"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Remote:</span>{" "}
                    {currentJob.is_remote === null
                      ? "Unknown"
                      : currentJob.is_remote
                        ? "Yes"
                        : "No"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Source:</span>{" "}
                    {currentJob.source || "Unknown"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Ingested via:</span>{" "}
                    {currentJob.ingestion_source || "Unknown"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Added:</span>{" "}
                    {format(new Date(currentJob.created_at), "MMM d, yyyy")}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Search terms:</span>{" "}
                    {currentJob.search_terms || "None"}
                  </div>
                  {currentJob.analyzed_at && (
                    <div>
                      <span className="text-muted-foreground">Analyzed:</span>{" "}
                      {format(new Date(currentJob.analyzed_at), "MMM d, h:mm a")}
                    </div>
                  )}
                  {currentJob.prepped_at && (
                    <div>
                      <span className="text-muted-foreground">Prepped:</span>{" "}
                      {format(new Date(currentJob.prepped_at), "MMM d, h:mm a")}
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href={currentJob.job_url} target="_blank" rel="noopener noreferrer">
                      View Job Posting
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                  {currentJob.application_url && (
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href={currentJob.application_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open Application
                        <ExternalLink className="ml-2 h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {detail.hasApplicationAnalysis && (
              <AccordionItem value="analysis">
                <AccordionTrigger>
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="h-4 w-4" />
                    <span>Application Requirements</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm text-indigo-700 dark:text-indigo-300">
                        Prep will use this analysis to decide which materials to generate.
                      </div>
                      <div className="flex items-center gap-2">
                        {currentJob.status === "analyzed" && onAnalyze && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onAnalyze?.(currentJob)}
                          >
                            <ClipboardCheck className="mr-2 h-4 w-4" />
                            Edit Analysis
                          </Button>
                        )}
                        {currentJob.analyzed_at && (
                          <span className="text-xs text-indigo-700/80 dark:text-indigo-300/80">
                            {format(new Date(currentJob.analyzed_at), "MMM d, h:mm a")}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="grid gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <span className="text-muted-foreground">Application type:</span>{" "}
                        <span className="capitalize">
                          {currentJob.application_type || "Unknown"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Cover letter:</span>{" "}
                        {currentJob.requires_cover_letter === null
                          ? "Unknown"
                          : currentJob.requires_cover_letter
                            ? "Required"
                            : "Not required"}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Resume:</span>{" "}
                        {currentJob.requires_resume === null
                          ? "Unknown"
                          : currentJob.requires_resume
                            ? "Required"
                            : "Not required"}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Screening questions:</span>{" "}
                        {currentJob.screening_questions?.length ?? 0}
                      </div>
                    </div>
                    {!!currentJob.screening_questions?.length && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                          Questions to prep
                        </p>
                        <ul className="space-y-1 text-sm">
                          {currentJob.screening_questions?.map((question, index) => {
                            const questionText = getScreeningQuestionText(question);
                            if (!questionText) {
                              return null;
                            }

                            return (
                              <li
                                key={`${currentJob.id}-screening-${index}`}
                                className="bg-background/70 rounded-md px-3 py-2"
                              >
                                {questionText}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {detail.hasPreppedMaterials && (
              <AccordionItem value="materials">
                <AccordionTrigger>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span>Application Materials</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm text-cyan-700 dark:text-cyan-300">
                        Review and adjust the generated materials before you apply.
                      </div>
                      {detail.hasPdf && (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={detail.handlePreviewPdf}
                            className="border-cyan-500/30 hover:bg-cyan-500/10"
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            Preview
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={detail.handleDownloadPdf}
                            disabled={detail.isDownloading}
                            className="border-cyan-500/30 hover:bg-cyan-500/10"
                          >
                            {detail.isDownloading ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="mr-2 h-4 w-4" />
                            )}
                            Download
                          </Button>
                        </div>
                      )}
                    </div>

                    {currentJob.cover_letter && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium">Cover Letter</label>
                          {detail.coverLetterDirty && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={detail.handleSaveCoverLetter}
                              disabled={detail.isUpdating}
                              className="h-7 text-xs"
                            >
                              {detail.isUpdating ? (
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              ) : (
                                <Save className="mr-1 h-3 w-3" />
                              )}
                              Save Changes
                            </Button>
                          )}
                        </div>
                        <Textarea
                          value={detail.coverLetter}
                          onChange={(e) => {
                            detail.setCoverLetter(e.target.value);
                            detail.setCoverLetterDirty(e.target.value !== currentJob.cover_letter);
                          }}
                          placeholder="Your cover letter..."
                          rows={8}
                          className="font-mono text-sm"
                        />
                      </div>
                    )}

                    {currentJob.prep_notes && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Prep Notes & Talking Points</p>
                        <div className="bg-background/80 rounded-md p-3 text-sm">
                          <pre className="font-sans whitespace-pre-wrap">
                            {currentJob.prep_notes}
                          </pre>
                        </div>
                      </div>
                    )}

                    {detail.hasPdf && (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                          <CheckCircle className="h-4 w-4" />
                          <span>
                            PDF generated{" "}
                            {currentJob.cover_letter_generated_at
                              ? format(
                                  new Date(currentJob.cover_letter_generated_at),
                                  "MMM d, h:mm a"
                                )
                              : ""}
                          </span>
                        </div>
                        {detail.coverLetterDirty && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={detail.handleRegeneratePdf}
                            disabled={detail.isGeneratingPdf}
                            className="h-7 border-amber-500/30 text-xs hover:bg-amber-500/10"
                          >
                            {detail.isGeneratingPdf ? (
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            ) : (
                              <RefreshCw className="mr-1 h-3 w-3" />
                            )}
                            Regenerate PDF
                          </Button>
                        )}
                      </div>
                    )}

                    {detail.hasPdf && detail.coverLetterDirty && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        Cover letter has been modified. Save changes and regenerate the PDF to
                        update.
                      </p>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {currentJob.reasoning && (
              <AccordionItem value="match">
                <AccordionTrigger>
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    <span>AI Match Analysis</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="bg-muted rounded-lg p-3 text-sm leading-relaxed">
                    {currentJob.reasoning}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {currentJob.description && (
              <AccordionItem value="description">
                <AccordionTrigger>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span>Full Description</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="bg-muted max-h-60 overflow-y-auto rounded-lg p-3">
                    <p className="text-sm whitespace-pre-wrap">{currentJob.description}</p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            <AccordionItem value="notes">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  <span>Personal Notes</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-muted-foreground text-sm">
                      Save recruiter details, reminders, or application context here.
                    </p>
                    {detail.notesDirty && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={detail.handleSaveNotes}
                        disabled={detail.isUpdating}
                        className="h-7 text-xs"
                      >
                        {detail.isUpdating ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : (
                          <Save className="mr-1 h-3 w-3" />
                        )}
                        Save
                      </Button>
                    )}
                  </div>
                  <Textarea
                    value={detail.notes}
                    onChange={(e) => {
                      detail.setNotes(e.target.value);
                      detail.setNotesDirty(e.target.value !== (currentJob.notes || ""));
                    }}
                    placeholder="Add notes about this job..."
                    rows={4}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <div className="flex items-center justify-between border-t pt-4">
            <div className="flex items-center gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={detail.handleDelete}
                disabled={detail.isDeleting}
              >
                {detail.isDeleting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Delete
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/jobs/${currentJob.id}`} onClick={onClose}>
                  <Maximize2 className="mr-2 h-4 w-4" />
                  Full View
                </Link>
              </Button>
            </div>
            <Button asChild>
              <a href={currentJob.job_url} target="_blank" rel="noopener noreferrer">
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
