"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useConfirmDialog } from "@/components/shared/feedback";
import { usePipelines } from "@/hooks/use-pipelines";
import { apiClient } from "@/lib/api-client";
import type { Job, JobStatus, JobUpdate } from "@/types";
import { shouldGenerateReviewPdf } from "@/types";

interface UseJobDetailOptions {
  jobId?: string;
  initialJob?: Job | null;
  onDelete: (jobId: string) => Promise<boolean>;
  onUpdate: (jobId: string, update: JobUpdate) => Promise<Job | null>;
  onDeleteSuccess?: () => void;
  onJobChange?: (job: Job | null) => void;
}

interface ApplyJobOptions {
  resetDrafts?: boolean;
  syncParent?: boolean;
}

export function useJobDetail({
  jobId,
  initialJob = null,
  onDelete,
  onUpdate,
  onDeleteSuccess,
  onJobChange,
}: UseJobDetailOptions) {
  const confirmDialog = useConfirmDialog();
  const { getExecutionState } = usePipelines();
  const prepExecState = getExecutionState("job_prep");
  const resolvedJobId = useMemo(() => jobId ?? initialJob?.id ?? null, [initialJob?.id, jobId]);
  const initialJobSyncKey = useMemo(() => {
    if (!initialJob) {
      return null;
    }

    return `${initialJob.id}:${initialJob.updated_at ?? initialJob.created_at}`;
  }, [initialJob?.created_at, initialJob?.id, initialJob?.updated_at]);
  const initialJobSnapshot = useMemo(() => initialJob ?? null, [initialJobSyncKey]);

  const [job, setJob] = useState<Job | null>(initialJob);
  const [isLoading, setIsLoading] = useState(!initialJob && !!resolvedJobId);
  const [notes, setNotes] = useState(initialJob?.notes || "");
  const [coverLetter, setCoverLetter] = useState(initialJob?.cover_letter || "");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [coverLetterDirty, setCoverLetterDirty] = useState(false);
  const [notesDirty, setNotesDirty] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const applyJob = useCallback(
    (nextJob: Job | null, options: ApplyJobOptions = {}) => {
      const { resetDrafts = true, syncParent = true } = options;

      setJob(nextJob);
      if (resetDrafts) {
        setNotes(nextJob?.notes || "");
        setCoverLetter(nextJob?.cover_letter || "");
        setCoverLetterDirty(false);
        setNotesDirty(false);
        setPdfError(null);
        setDownloadError(null);
      }

      if (syncParent) {
        onJobChange?.(nextJob);
      }
    },
    [onJobChange]
  );

  const refreshJob = useCallback(async () => {
    if (!resolvedJobId) {
      applyJob(null);
      return null;
    }

    try {
      const fetchedJob = await apiClient.get<Job>(`/jobs/${resolvedJobId}`);
      applyJob(fetchedJob);
      return fetchedJob;
    } catch {
      applyJob(null);
      return null;
    }
  }, [applyJob, resolvedJobId]);

  useEffect(() => {
    if (!resolvedJobId) {
      setIsLoading(false);
      applyJob(null, { syncParent: false });
      return;
    }

    if (initialJobSnapshot && initialJobSnapshot.id === resolvedJobId) {
      applyJob(initialJobSnapshot, { syncParent: false });
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }

    let cancelled = false;

    const loadJob = async () => {
      try {
        const fetchedJob = await apiClient.get<Job>(`/jobs/${resolvedJobId}`);
        if (!cancelled) {
          applyJob(fetchedJob);
        }
      } catch {
        if (!cancelled && !initialJobSnapshot) {
          applyJob(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadJob();

    return () => {
      cancelled = true;
    };
  }, [applyJob, initialJobSnapshot, resolvedJobId]);

  const handleStatusChange = useCallback(
    async (newStatus: JobStatus) => {
      if (!job) {
        return;
      }

      setIsUpdating(true);
      const updated = await onUpdate(job.id, { status: newStatus });
      if (updated) {
        applyJob(updated);
      }
      setIsUpdating(false);
    },
    [applyJob, job, onUpdate]
  );

  const handleSaveNotes = useCallback(async () => {
    if (!job) {
      return;
    }

    setIsUpdating(true);
    const updated = await onUpdate(job.id, { notes });
    if (updated) {
      applyJob(updated);
    }
    setIsUpdating(false);
  }, [applyJob, job, notes, onUpdate]);

  const handleSaveCoverLetter = useCallback(async () => {
    if (!job) {
      return;
    }

    setIsUpdating(true);
    const updated = await onUpdate(job.id, { cover_letter: coverLetter });
    if (updated) {
      applyJob(updated);
    }
    setIsUpdating(false);
  }, [applyJob, coverLetter, job, onUpdate]);

  const handleMarkAsReviewed = useCallback(async () => {
    if (!job) {
      return;
    }

    if (coverLetterDirty) {
      const savedCoverLetter = await onUpdate(job.id, { cover_letter: coverLetter });
      if (savedCoverLetter) {
        applyJob(savedCoverLetter);
      }
    }

    setPdfError(null);

    if (!shouldGenerateReviewPdf(job, coverLetter)) {
      const updated = await onUpdate(job.id, { status: "reviewed" });
      if (updated) {
        applyJob(updated);
      }
      return;
    }

    setIsGeneratingPdf(true);

    try {
      await apiClient.post<Job>(`/jobs/${job.id}/cover-letter/generate-pdf`);
      const updated = await onUpdate(job.id, { status: "reviewed" });
      if (updated) {
        applyJob(updated);
      }
      await refreshJob();
    } catch (error) {
      setPdfError(error instanceof Error ? error.message : "Failed to generate PDF");
    } finally {
      setIsGeneratingPdf(false);
    }
  }, [applyJob, coverLetter, coverLetterDirty, job, onUpdate, refreshJob]);

  const handleDownloadPdf = useCallback(async () => {
    if (!job) {
      return;
    }

    setIsDownloading(true);
    setDownloadError(null);

    try {
      const response = await fetch(`/api/jobs/${job.id}/cover-letter/download`);
      if (!response.ok) {
        throw new Error("Failed to download PDF");
      }

      const blob = await response.blob();
      const filename =
        response.headers.get("Content-Disposition")?.match(/filename=\"(.+)\"/)?.[1] ||
        "cover-letter.pdf";

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "Failed to download PDF");
    } finally {
      setIsDownloading(false);
    }
  }, [job]);

  const handlePreviewPdf = useCallback(() => {
    if (!job) {
      return;
    }

    window.open(`/api/jobs/${job.id}/cover-letter/preview`, "_blank", "noopener,noreferrer");
  }, [job]);

  const handleRegeneratePdf = useCallback(async () => {
    if (!job) {
      return;
    }

    if (coverLetterDirty) {
      const savedCoverLetter = await onUpdate(job.id, { cover_letter: coverLetter });
      if (savedCoverLetter) {
        applyJob(savedCoverLetter);
      }
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
  }, [applyJob, coverLetter, coverLetterDirty, job, onUpdate, refreshJob]);

  const handleDelete = useCallback(async () => {
    if (!job) {
      return;
    }

    const confirmed = await confirmDialog({
      title: "Delete job?",
      description: "This will permanently remove the selected job.",
      confirmLabel: "Delete job",
      destructive: true,
    });

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    const success = await onDelete(job.id);
    setIsDeleting(false);
    if (success) {
      applyJob(null);
      onDeleteSuccess?.();
    }
  }, [applyJob, confirmDialog, job, onDelete, onDeleteSuccess]);

  const hasPreppedMaterials =
    !!job?.cover_letter ||
    !!job?.prep_notes ||
    Object.keys(job?.screening_answers ?? {}).length > 0;
  const hasPdf = !!job?.cover_letter_file_path;
  const isPrepping = prepExecState.status === "running";
  const hasApplicationAnalysis =
    !!job?.analyzed_at ||
    !!job?.application_type ||
    !!job?.application_url ||
    job?.requires_cover_letter !== null ||
    job?.requires_resume !== null ||
    !!job?.screening_questions?.length;

  return {
    job,
    isLoading,
    notes,
    setNotes,
    coverLetter,
    setCoverLetter,
    isUpdating,
    isDeleting,
    isGeneratingPdf,
    isDownloading,
    coverLetterDirty,
    setCoverLetterDirty,
    notesDirty,
    setNotesDirty,
    pdfError,
    downloadError,
    hasPreppedMaterials,
    hasPdf,
    isPrepping,
    hasApplicationAnalysis,
    refreshJob,
    handleStatusChange,
    handleSaveNotes,
    handleSaveCoverLetter,
    handleMarkAsReviewed,
    handleDownloadPdf,
    handlePreviewPdf,
    handleRegeneratePdf,
    handleDelete,
  };
}
