"use client";

import { useCallback, useState } from "react";
import { useJobs } from "@/hooks";
import { usePipelines } from "@/hooks/use-pipelines";
import type { Job } from "@/types";
import { useManualAnalyzeDialog } from "@/components/shared/jobs";

export function useJobsListScreen() {
  const {
    jobs,
    total,
    isLoading,
    filters,
    stats,
    statsLoading,
    selectedJob,
    fetchJobs,
    fetchStats,
    updateJobStatus,
    deleteJob,
    setFilters,
    resetFilters,
    setSelectedJob,
    goToPage,
  } = useJobs();
  const { getExecutionState } = usePipelines();
  const prepExecState = getExecutionState("job_prep");
  const {
    job: analyzeJob,
    isOpen: isManualAnalyzeModalOpen,
    open: openManualAnalyze,
    close: closeManualAnalyze,
    complete: completeManualAnalyze,
  } = useManualAnalyzeDialog({
    onComplete: (updatedJob) => {
      refresh();
      setSelectedJob(updatedJob);
    },
  });

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isManualJobModalOpen, setIsManualJobModalOpen] = useState(false);
  const [isPrepModalOpen, setIsPrepModalOpen] = useState(false);
  const [isBatchPrepModalOpen, setIsBatchPrepModalOpen] = useState(false);
  const [isDeleteByStatusModalOpen, setIsDeleteByStatusModalOpen] = useState(false);
  const [prepJob, setPrepJob] = useState<Job | null>(null);

  const refresh = useCallback(() => {
    void fetchJobs();
    void fetchStats();
  }, [fetchJobs, fetchStats]);

  const handleJobClick = useCallback(
    (job: Job) => {
      setSelectedJob(job);
      setIsDetailModalOpen(true);
    },
    [setSelectedJob]
  );

  const handleCloseDetailModal = useCallback(() => {
    setIsDetailModalOpen(false);
    setSelectedJob(null);
  }, [setSelectedJob]);

  const handleSort = useCallback(
    (sortBy: string, sortOrder: "asc" | "desc") => {
      setFilters({
        sort_by: sortBy as "created_at" | "relevance_score" | "date_posted" | "company",
        sort_order: sortOrder,
      });
    },
    [setFilters]
  );

  const handleDelete = useCallback(
    async (jobId: string): Promise<boolean> => {
      return deleteJob(jobId);
    },
    [deleteJob]
  );

  const handlePrep = useCallback((job: Job) => {
    setPrepJob(job);
    setIsPrepModalOpen(true);
  }, []);

  const handleAnalyze = useCallback(
    (job: Job) => {
      openManualAnalyze(job);
    },
    [openManualAnalyze]
  );

  const handlePrepComplete = useCallback(() => {
    refresh();
    setSelectedJob(null);
  }, [refresh, setSelectedJob]);

  const handleClosePrepModal = useCallback(() => {
    setIsPrepModalOpen(false);
    setPrepJob(null);
  }, []);

  const preppingJobId = prepExecState.status === "running" ? prepJob?.id : null;

  return {
    jobs,
    total,
    isLoading,
    filters,
    stats,
    statsLoading,
    selectedJob,
    analyzeJob,
    prepJob,
    isDetailModalOpen,
    isManualJobModalOpen,
    isManualAnalyzeModalOpen,
    isPrepModalOpen,
    isBatchPrepModalOpen,
    isDeleteByStatusModalOpen,
    preppingJobId,
    updateJobStatus,
    setSelectedJob,
    setFilters,
    resetFilters,
    goToPage,
    refresh,
    handleJobClick,
    handleCloseDetailModal,
    handleSort,
    handleDelete,
    handleAnalyze,
    handlePrep,
    handleManualAnalyzeComplete: completeManualAnalyze,
    handleCloseManualAnalyzeModal: closeManualAnalyze,
    handlePrepComplete,
    handleClosePrepModal,
    setIsManualJobModalOpen,
    setIsBatchPrepModalOpen,
    setIsDeleteByStatusModalOpen,
  };
}
