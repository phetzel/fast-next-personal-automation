"use client";

import { useCallback, useState } from "react";
import { useJobs } from "@/hooks";
import type { Job } from "@/types";
import { useManualAnalyzeDialog } from "@/components/shared/jobs";

export function useJobsOverviewScreen() {
  const {
    jobs,
    isLoading,
    stats,
    statsLoading,
    selectedJob,
    updateJobStatus,
    deleteJob,
    setSelectedJob,
  } = useJobs({
    initialFilters: {
      page: 1,
      page_size: 6,
      sort_by: "created_at",
      sort_order: "desc",
    },
  });
  const {
    job: analyzeJob,
    isOpen: isManualAnalyzeModalOpen,
    open: openManualAnalyze,
    close: closeManualAnalyze,
    complete: completeManualAnalyze,
  } = useManualAnalyzeDialog({
    onComplete: (updatedJob) => {
      setSelectedJob(updatedJob);
    },
  });
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleJobClick = useCallback(
    (job: Job) => {
      setSelectedJob(job);
      setIsModalOpen(true);
    },
    [setSelectedJob]
  );

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedJob(null);
  }, [setSelectedJob]);

  const handleAnalyze = useCallback(
    (job: Job) => {
      openManualAnalyze(job);
    },
    [openManualAnalyze]
  );

  return {
    jobs,
    isLoading,
    stats,
    statsLoading,
    selectedJob,
    analyzeJob,
    isModalOpen,
    isManualAnalyzeModalOpen,
    updateJobStatus,
    deleteJob,
    setSelectedJob,
    handleJobClick,
    handleCloseModal,
    handleAnalyze,
    handleCloseAnalyzeModal: closeManualAnalyze,
    handleAnalyzeComplete: completeManualAnalyze,
  };
}
