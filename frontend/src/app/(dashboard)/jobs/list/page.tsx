"use client";

import { useEffect, useState } from "react";
import { useJobs } from "@/hooks";
import {
  JobTable,
  JobFilters,
  JobDetailModal,
  JobStatsCard,
} from "@/components/jobs";
import { Button } from "@/components/ui";
import type { Job } from "@/types";
import { RefreshCw, Workflow } from "lucide-react";
import Link from "next/link";
import { ROUTES } from "@/lib/constants";

export default function JobsListPage() {
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

  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch jobs on mount and when filters change
  useEffect(() => {
    fetchJobs();
  }, [filters.page, filters.status, filters.sort_by, filters.sort_order, filters.search]);

  // Fetch stats on mount
  useEffect(() => {
    fetchStats();
  }, []);

  const handleJobClick = (job: Job) => {
    setSelectedJob(job);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedJob(null);
  };

  const handleRefresh = () => {
    fetchJobs();
    fetchStats();
  };

  const handleSort = (sortBy: string, sortOrder: "asc" | "desc") => {
    setFilters({
      sort_by: sortBy as "created_at" | "relevance_score" | "date_posted" | "company",
      sort_order: sortOrder,
    });
  };

  const handleDelete = async (jobId: string): Promise<boolean> => {
    const success = await deleteJob(jobId);
    if (success) {
      // Refresh stats after successful deletion
      fetchStats();
    }
    return success;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Job Listings</h1>
          <p className="text-muted-foreground">
            View and manage jobs from your searches
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button asChild>
            <Link href={ROUTES.JOBS_PIPELINES}>
              <Workflow className="mr-2 h-4 w-4" />
              Run Pipelines
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <JobStatsCard stats={stats} isLoading={statsLoading} />

      {/* Filters */}
      <JobFilters
        filters={filters}
        onFiltersChange={setFilters}
        onReset={resetFilters}
      />

      {/* Job Table */}
      <JobTable
        jobs={jobs}
        total={total}
        page={filters.page || 1}
        pageSize={filters.page_size || 20}
        isLoading={isLoading}
        onJobClick={handleJobClick}
        onDelete={handleDelete}
        onPageChange={goToPage}
        onSort={handleSort}
      />

      {/* Detail Modal */}
      <JobDetailModal
        job={selectedJob}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onUpdate={updateJobStatus}
        onDelete={handleDelete}
      />
    </div>
  );
}

