"use client";

import { useCallback, useState } from "react";
import { useJobs } from "@/hooks";
import { usePipelines } from "@/hooks/use-pipelines";
import type { Job } from "@/types";

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

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isSearchAllModalOpen, setIsSearchAllModalOpen] = useState(false);
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
    prepJob,
    isDetailModalOpen,
    isSearchModalOpen,
    isSearchAllModalOpen,
    isManualJobModalOpen,
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
    handlePrep,
    handlePrepComplete,
    handleClosePrepModal,
    setIsSearchModalOpen,
    setIsSearchAllModalOpen,
    setIsManualJobModalOpen,
    setIsBatchPrepModalOpen,
    setIsDeleteByStatusModalOpen,
  };
}
