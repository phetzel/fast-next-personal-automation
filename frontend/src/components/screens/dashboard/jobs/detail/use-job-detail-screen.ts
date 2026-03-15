"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useJobs } from "@/hooks";
import { useJobDetail } from "@/components/shared/jobs/use-job-detail";
import type { JobStatus } from "@/types";

export type JobDetailTabId = "overview" | "prep";

export function useJobDetailScreen(jobId: string) {
  const router = useRouter();
  const { deleteJob, setSelectedJob, updateJobStatus } = useJobs();
  const [activeTab, setActiveTab] = useState<JobDetailTabId>("overview");
  const [isPrepModalOpen, setIsPrepModalOpen] = useState(false);

  const detail = useJobDetail({
    jobId,
    onDelete: deleteJob,
    onUpdate: updateJobStatus,
    onDeleteSuccess: () => router.push("/jobs/list"),
    onJobChange: setSelectedJob,
  });

  const handleStatusChange = useCallback(
    async (newStatus: JobStatus) => {
      if (!detail.job) {
        return;
      }

      if (newStatus === "prepped" && detail.job.status === "analyzed") {
        setIsPrepModalOpen(true);
        return;
      }

      if (newStatus === "reviewed" && detail.job.status === "prepped") {
        await detail.handleMarkAsReviewed();
        return;
      }

      await detail.handleStatusChange(newStatus);
    },
    [detail]
  );

  const handlePrepComplete = useCallback(async () => {
    await detail.refreshJob();
    setActiveTab("prep");
  }, [detail]);

  return {
    ...detail,
    activeTab,
    setActiveTab,
    isPrepModalOpen,
    setIsPrepModalOpen,
    handleStatusChange,
    handlePrepComplete,
  };
}
