"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useJobs } from "@/hooks";
import { usePipelines } from "@/hooks/use-pipelines";
import { apiClient } from "@/lib/api-client";
import { Button, Textarea, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { ScoreBadge, StatusBadge, PrepJobModal } from "@/components/jobs";
import type { Job, JobStatus, JobUpdate } from "@/types";
import { JOB_STATUSES, JOB_STATUS_CONFIG, canTransitionTo } from "@/types";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  ArrowLeft,
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
  Briefcase,
  Globe,
  DollarSign,
  Clock,
  MessageSquare,
  FileCheck,
} from "lucide-react";

type TabId = "overview" | "cover-letter" | "application";

interface TabConfig {
  id: TabId;
  label: string;
  icon: React.ElementType;
}

const TABS: TabConfig[] = [
  { id: "overview", label: "Overview", icon: Briefcase },
  { id: "cover-letter", label: "Cover Letter", icon: FileText },
  { id: "application", label: "Application", icon: FileCheck },
];

// Generate status options from the shared constant
const STATUS_OPTIONS = JOB_STATUSES.map((status) => ({
  value: status,
  label: JOB_STATUS_CONFIG[status].label,
  description: JOB_STATUS_CONFIG[status].description,
}));

export default function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: jobId } = use(params);
  const router = useRouter();
  const { fetchJob, updateJobStatus, deleteJob } = useJobs();
  const { getExecutionState } = usePipelines();
  const prepExecState = getExecutionState("job_prep");

  const [job, setJob] = useState<Job | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [isPrepModalOpen, setIsPrepModalOpen] = useState(false);

  // Form state
  const [notes, setNotes] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [coverLetterDirty, setCoverLetterDirty] = useState(false);
  const [notesDirty, setNotesDirty] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Fetch job on mount
  useEffect(() => {
    const loadJob = async () => {
      setIsLoading(true);
      const fetchedJob = await fetchJob(jobId);
      if (fetchedJob) {
        setJob(fetchedJob);
        setNotes(fetchedJob.notes || "");
        setCoverLetter(fetchedJob.cover_letter || "");
      }
      setIsLoading(false);
    };
    loadJob();
  }, [jobId, fetchJob]);

  // Auto-switch to cover letter tab when prepped
  useEffect(() => {
    if (job?.cover_letter && activeTab === "overview") {
      // Don't auto-switch, let user explore
    }
  }, [job?.cover_letter, activeTab]);

  const refreshJob = async () => {
    const fetchedJob = await fetchJob(jobId);
    if (fetchedJob) {
      setJob(fetchedJob);
      setNotes(fetchedJob.notes || "");
      setCoverLetter(fetchedJob.cover_letter || "");
      setCoverLetterDirty(false);
      setNotesDirty(false);
    }
  };

  const handleStatusChange = async (newStatus: JobStatus) => {
    if (!job) return;

    // Special handling for transitioning to "reviewed" - generates PDF
    if (newStatus === "reviewed" && job.status === "prepped") {
      await handleMarkAsReviewed();
      return;
    }

    setIsUpdating(true);
    const updated = await updateJobStatus(job.id, { status: newStatus });
    if (updated) {
      setJob(updated);
    }
    setIsUpdating(false);
  };

  const handleSaveNotes = async () => {
    if (!job) return;
    setIsUpdating(true);
    const updated = await updateJobStatus(job.id, { notes });
    if (updated) {
      setJob(updated);
      setNotesDirty(false);
    }
    setIsUpdating(false);
  };

  const handleSaveCoverLetter = async () => {
    if (!job) return;
    setIsUpdating(true);
    const updated = await updateJobStatus(job.id, { cover_letter: coverLetter });
    if (updated) {
      setJob(updated);
      setCoverLetterDirty(false);
    }
    setIsUpdating(false);
  };

  const handleMarkAsReviewed = async () => {
    if (!job) return;

    // Save any pending cover letter changes first
    if (coverLetterDirty) {
      await updateJobStatus(job.id, { cover_letter: coverLetter });
      setCoverLetterDirty(false);
    }

    setIsGeneratingPdf(true);
    setPdfError(null);

    try {
      await apiClient.post<Job>(`/jobs/${job.id}/cover-letter/generate-pdf`);
      const updated = await updateJobStatus(job.id, { status: "reviewed" });
      if (updated) {
        setJob(updated);
      }
      await refreshJob();
    } catch (error) {
      setPdfError(error instanceof Error ? error.message : "Failed to generate PDF");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!job) return;
    setIsDownloading(true);
    try {
      const response = await fetch(`/api/jobs/${job.id}/cover-letter/download`);
      if (!response.ok) throw new Error("Failed to download PDF");

      const blob = await response.blob();
      const filename =
        response.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ||
        "cover-letter.pdf";

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
    if (!job) return;
    window.open(`/api/jobs/${job.id}/cover-letter/preview`, "_blank");
  };

  const handleRegeneratePdf = async () => {
    if (!job) return;

    if (coverLetterDirty) {
      await updateJobStatus(job.id, { cover_letter: coverLetter });
      setCoverLetterDirty(false);
    }

    setIsGeneratingPdf(true);
    setPdfError(null);

    try {
      await apiClient.post<Job>(`/jobs/${job.id}/cover-letter/generate-pdf`);
      await refreshJob();
    } catch (error) {
      setPdfError(error instanceof Error ? error.message : "Failed to regenerate PDF");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleDelete = async () => {
    if (!job) return;
    if (!confirm("Are you sure you want to delete this job?")) return;
    setIsDeleting(true);
    const success = await deleteJob(job.id);
    setIsDeleting(false);
    if (success) {
      router.push("/jobs/list");
    }
  };

  const handlePrepComplete = async () => {
    await refreshJob();
    setActiveTab("cover-letter");
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Job not found</p>
        <Button asChild variant="outline">
          <Link href="/jobs/list">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Jobs
          </Link>
        </Button>
      </div>
    );
  }

  const postedDate = job.date_posted ? format(new Date(job.date_posted), "MMM d, yyyy") : null;
  const hasPreppedMaterials = !!job.cover_letter || !!job.prep_notes;
  const hasPdf = !!job.cover_letter_file_path;
  const isPrepping = prepExecState.status === "running";

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Back */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/jobs/list" className="hover:text-foreground transition-colors">
          Jobs
        </Link>
        <span>/</span>
        <span className="text-foreground truncate max-w-[300px]">{job.title}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">{job.title}</h1>
            <StatusBadge status={job.status} />
            <ScoreBadge score={job.relevance_score} />
          </div>
          <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Building2 className="h-4 w-4" />
              <span className="font-medium">{job.company}</span>
            </div>
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
              <div className="flex items-center gap-1.5">
                <Globe className="h-4 w-4" />
                <span className="capitalize">{job.source}</span>
              </div>
            )}
          </div>
          {job.salary_range && (
            <div className="flex items-center gap-1.5 text-green-600 font-semibold">
              <DollarSign className="h-4 w-4" />
              {job.salary_range}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <a href={job.job_url} target="_blank" rel="noopener noreferrer">
              View Posting
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
          <Button variant="destructive" size="icon" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Status Bar */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium mr-2">Status:</span>
            {STATUS_OPTIONS.map((option) => {
              const isCurrentStatus = job.status === option.value;
              const canTransition = canTransitionTo(job.status, option.value);
              const isReviewedTransition = option.value === "reviewed" && job.status === "prepped";

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
              <span className="text-purple-600 dark:text-purple-400">Tip:</span> Clicking
              &quot;Reviewed&quot; will generate a PDF of your cover letter.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-6" aria-label="Tabs">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const showBadge = tab.id === "cover-letter" && hasPreppedMaterials;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                {showBadge && (
                  <span className="flex h-2 w-2 rounded-full bg-cyan-500" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === "overview" && (
          <OverviewTab
            job={job}
            onPrep={() => setIsPrepModalOpen(true)}
            hasPreppedMaterials={hasPreppedMaterials}
            isPrepping={isPrepping}
          />
        )}

        {activeTab === "cover-letter" && (
          <CoverLetterTab
            job={job}
            coverLetter={coverLetter}
            setCoverLetter={setCoverLetter}
            coverLetterDirty={coverLetterDirty}
            setCoverLetterDirty={setCoverLetterDirty}
            isUpdating={isUpdating}
            isGeneratingPdf={isGeneratingPdf}
            isDownloading={isDownloading}
            hasPdf={hasPdf}
            pdfError={pdfError}
            onSave={handleSaveCoverLetter}
            onPreview={handlePreviewPdf}
            onDownload={handleDownloadPdf}
            onRegenerate={handleRegeneratePdf}
            onPrep={() => setIsPrepModalOpen(true)}
            hasPreppedMaterials={hasPreppedMaterials}
            isPrepping={isPrepping}
          />
        )}

        {activeTab === "application" && (
          <ApplicationTab
            job={job}
            notes={notes}
            setNotes={setNotes}
            notesDirty={notesDirty}
            setNotesDirty={setNotesDirty}
            isUpdating={isUpdating}
            onSaveNotes={handleSaveNotes}
          />
        )}
      </div>

      {/* Prep Modal */}
      <PrepJobModal
        job={job}
        isOpen={isPrepModalOpen}
        onClose={() => setIsPrepModalOpen(false)}
        onComplete={handlePrepComplete}
      />
    </div>
  );
}

// ============================================================================
// Tab Components
// ============================================================================

function OverviewTab({
  job,
  onPrep,
  hasPreppedMaterials,
  isPrepping,
}: {
  job: Job;
  onPrep: () => void;
  hasPreppedMaterials: boolean;
  isPrepping: boolean;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Main content */}
      <div className="lg:col-span-2 space-y-6">
        {/* AI Analysis */}
        {job.reasoning && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="h-5 w-5 text-amber-500" />
                AI Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed">{job.reasoning}</p>
            </CardContent>
          </Card>
        )}

        {/* Description */}
        {job.description && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Job Description</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <p className="whitespace-pre-wrap text-sm">{job.description}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Sidebar */}
      <div className="space-y-6">
        {/* Quick Actions */}
        {!hasPreppedMaterials && (
          <Card className="border-2 border-dashed border-primary/30 bg-primary/5">
            <CardContent className="py-6">
              <div className="flex flex-col items-center text-center">
                <div className="rounded-full bg-primary/10 p-3 mb-3">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-1">Ready to Prepare?</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Generate a tailored cover letter and prep notes for this job.
                </p>
                <Button onClick={onPrep} disabled={isPrepping}>
                  {isPrepping ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  Prepare Materials
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Job Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {job.job_type && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Type</span>
                <span className="capitalize">{job.job_type}</span>
              </div>
            )}
            {job.is_remote !== null && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Remote</span>
                <span>{job.is_remote ? "Yes" : "No"}</span>
              </div>
            )}
            {job.search_terms && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Search Terms</span>
                <span className="truncate max-w-[150px]">{job.search_terms}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Added</span>
              <span>{format(new Date(job.created_at), "MMM d, yyyy")}</span>
            </div>
            {job.prepped_at && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Prepped</span>
                <span>{format(new Date(job.prepped_at), "MMM d, yyyy")}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CoverLetterTab({
  job,
  coverLetter,
  setCoverLetter,
  coverLetterDirty,
  setCoverLetterDirty,
  isUpdating,
  isGeneratingPdf,
  isDownloading,
  hasPdf,
  pdfError,
  onSave,
  onPreview,
  onDownload,
  onRegenerate,
  onPrep,
  hasPreppedMaterials,
  isPrepping,
}: {
  job: Job;
  coverLetter: string;
  setCoverLetter: (v: string) => void;
  coverLetterDirty: boolean;
  setCoverLetterDirty: (v: boolean) => void;
  isUpdating: boolean;
  isGeneratingPdf: boolean;
  isDownloading: boolean;
  hasPdf: boolean;
  pdfError: string | null;
  onSave: () => void;
  onPreview: () => void;
  onDownload: () => void;
  onRegenerate: () => void;
  onPrep: () => void;
  hasPreppedMaterials: boolean;
  isPrepping: boolean;
}) {
  if (!hasPreppedMaterials) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <FileText className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No Cover Letter Yet</h3>
        <p className="text-muted-foreground mb-6 max-w-md">
          Generate a tailored cover letter by preparing this job. The AI will create a
          personalized letter based on your resume and the job description.
        </p>
        <Button onClick={onPrep} disabled={isPrepping}>
          {isPrepping ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          Prepare Materials
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Editor */}
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Cover Letter</CardTitle>
              <div className="flex items-center gap-2">
                {coverLetterDirty && (
                  <Button size="sm" variant="outline" onClick={onSave} disabled={isUpdating}>
                    {isUpdating ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save Changes
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Textarea
              value={coverLetter}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                setCoverLetter(e.target.value);
                setCoverLetterDirty(e.target.value !== job.cover_letter);
              }}
              placeholder="Your cover letter..."
              rows={20}
              className="font-mono text-sm resize-none"
            />
          </CardContent>
        </Card>

        {/* Prep Notes */}
        {job.prep_notes && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageSquare className="h-5 w-5" />
                Prep Notes & Talking Points
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap text-sm font-sans">{job.prep_notes}</pre>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Sidebar */}
      <div className="space-y-4">
        {/* PDF Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">PDF Document</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pdfError && (
              <div className="rounded-md border border-red-500/20 bg-red-500/5 p-3">
                <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                  <AlertCircle className="h-4 w-4" />
                  <span>{pdfError}</span>
                </div>
              </div>
            )}

            {hasPdf ? (
              <>
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <CheckCircle className="h-4 w-4" />
                  <span>
                    PDF generated{" "}
                    {job.cover_letter_generated_at
                      ? format(new Date(job.cover_letter_generated_at), "MMM d, h:mm a")
                      : ""}
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  <Button variant="outline" onClick={onPreview} className="justify-start">
                    <Eye className="mr-2 h-4 w-4" />
                    Preview PDF
                  </Button>
                  <Button variant="outline" onClick={onDownload} disabled={isDownloading} className="justify-start">
                    {isDownloading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    Download PDF
                  </Button>
                </div>

                {coverLetterDirty && (
                  <>
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Cover letter has been modified. Save and regenerate to update the PDF.
                    </p>
                    <Button
                      variant="outline"
                      onClick={onRegenerate}
                      disabled={isGeneratingPdf}
                      className="w-full border-amber-500/30 hover:bg-amber-500/10"
                    >
                      {isGeneratingPdf ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                      )}
                      Regenerate PDF
                    </Button>
                  </>
                )}
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-3">
                  No PDF generated yet. Mark as &quot;Reviewed&quot; to generate.
                </p>
                <Button
                  variant="outline"
                  onClick={onRegenerate}
                  disabled={isGeneratingPdf}
                >
                  {isGeneratingPdf ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="mr-2 h-4 w-4" />
                  )}
                  Generate PDF
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ApplicationTab({
  job,
  notes,
  setNotes,
  notesDirty,
  setNotesDirty,
  isUpdating,
  onSaveNotes,
}: {
  job: Job;
  notes: string;
  setNotes: (v: string) => void;
  notesDirty: boolean;
  setNotesDirty: (v: boolean) => void;
  isUpdating: boolean;
  onSaveNotes: () => void;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Main content */}
      <div className="lg:col-span-2 space-y-6">
        {/* Notes */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Your Notes</CardTitle>
              {notesDirty && (
                <Button size="sm" variant="outline" onClick={onSaveNotes} disabled={isUpdating}>
                  {isUpdating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Textarea
              value={notes}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                setNotes(e.target.value);
                setNotesDirty(e.target.value !== (job.notes || ""));
              }}
              placeholder="Add notes about this job, interview prep, contact info, follow-up reminders..."
              rows={10}
              className="resize-none"
            />
          </CardContent>
        </Card>
      </div>

      {/* Sidebar */}
      <div className="space-y-4">
        {/* Application Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5" />
              Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <TimelineItem
                label="Added"
                date={job.created_at}
                isCompleted
              />
              {job.prepped_at && (
                <TimelineItem
                  label="Prepped"
                  date={job.prepped_at}
                  isCompleted
                />
              )}
              {job.cover_letter_generated_at && (
                <TimelineItem
                  label="PDF Generated"
                  date={job.cover_letter_generated_at}
                  isCompleted
                />
              )}
              {job.status === "applied" && (
                <TimelineItem
                  label="Applied"
                  date={job.updated_at || job.created_at}
                  isCompleted
                />
              )}
              {job.status === "interviewing" && (
                <TimelineItem
                  label="Interviewing"
                  date={job.updated_at || job.created_at}
                  isCompleted
                />
              )}
              {job.status === "rejected" && (
                <TimelineItem
                  label="Rejected"
                  date={job.updated_at || job.created_at}
                  isCompleted
                  isRejected
                />
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TimelineItem({
  label,
  date,
  isCompleted,
  isRejected,
}: {
  label: string;
  date: string;
  isCompleted?: boolean;
  isRejected?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "h-2 w-2 rounded-full",
          isRejected
            ? "bg-red-500"
            : isCompleted
            ? "bg-green-500"
            : "bg-muted-foreground/30"
        )}
      />
      <div className="flex-1 flex items-center justify-between">
        <span className="text-sm">{label}</span>
        <span className="text-xs text-muted-foreground">
          {format(new Date(date), "MMM d, h:mm a")}
        </span>
      </div>
    </div>
  );
}

