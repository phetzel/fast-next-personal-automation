"use client";

import { useCallback, useState } from "react";
import { useJobs } from "@/hooks";
import type { Job } from "@/types";

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

  return {
    jobs,
    isLoading,
    stats,
    statsLoading,
    selectedJob,
    isModalOpen,
    updateJobStatus,
    deleteJob,
    setSelectedJob,
    handleJobClick,
    handleCloseModal,
  };
}
