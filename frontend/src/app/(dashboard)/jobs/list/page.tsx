"use client";

import { useEffect, useState } from "react";
import { useJobs } from "@/hooks";
import { usePipelines } from "@/hooks/use-pipelines";
import {
  JobTable,
  JobFilters,
  JobDetailModal,
  JobStatsCard,
  SearchJobsModal,
  PrepJobModal,
} from "@/components/jobs";
import { Button } from "@/components/ui";
import type { Job } from "@/types";
import { RefreshCw, Search } from "lucide-react";

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

  const { getExecutionState } = usePipelines();
  const prepExecState = getExecutionState("job_prep");

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isPrepModalOpen, setIsPrepModalOpen] = useState(false);
  const [prepJob, setPrepJob] = useState<Job | null>(null);

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
    setIsDetailModalOpen(true);
  };

  const handleCloseDetailModal = () => {
    setIsDetailModalOpen(false);
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

  const handlePrep = (job: Job) => {
    setPrepJob(job);
    setIsPrepModalOpen(true);
  };

  const handlePrepComplete = () => {
    // Refresh the job list to show updated status
    fetchJobs();
    fetchStats();
    // If we have the prep job selected, refresh it
    if (prepJob) {
      setSelectedJob(null);
    }
  };

  const handleSearchComplete = () => {
    // Refresh jobs and stats after a successful search
    fetchJobs();
    fetchStats();
  };

  // Track which job is currently being prepped (from the modal)
  const preppingJobId = prepExecState.status === "running" ? prepJob?.id : null;

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
          <Button onClick={() => setIsSearchModalOpen(true)}>
            <Search className="mr-2 h-4 w-4" />
            Search Jobs
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
        preppingJobId={preppingJobId}
        onJobClick={handleJobClick}
        onDelete={handleDelete}
        onPrep={handlePrep}
        onPageChange={goToPage}
        onSort={handleSort}
      />

      {/* Detail Modal */}
      <JobDetailModal
        job={selectedJob}
        isOpen={isDetailModalOpen}
        onClose={handleCloseDetailModal}
        onUpdate={updateJobStatus}
        onDelete={handleDelete}
        onPrep={handlePrep}
      />

      {/* Search Modal */}
      <SearchJobsModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onComplete={handleSearchComplete}
      />

      {/* Prep Modal */}
      <PrepJobModal
        job={prepJob}
        isOpen={isPrepModalOpen}
        onClose={() => {
          setIsPrepModalOpen(false);
          setPrepJob(null);
        }}
        onComplete={handlePrepComplete}
      />
    </div>
  );
}
