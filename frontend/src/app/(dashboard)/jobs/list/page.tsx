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
  SearchAllJobsModal,
  PrepJobModal,
  BatchPrepModal,
  DeleteByStatusModal,
} from "@/components/jobs";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui";
import type { Job } from "@/types";
import { RefreshCw, Search, ChevronDown, Layers, Globe, Trash2 } from "lucide-react";

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
  const [isSearchAllModalOpen, setIsSearchAllModalOpen] = useState(false);
  const [isPrepModalOpen, setIsPrepModalOpen] = useState(false);
  const [isBatchPrepModalOpen, setIsBatchPrepModalOpen] = useState(false);
  const [isDeleteByStatusModalOpen, setIsDeleteByStatusModalOpen] = useState(false);
  const [prepJob, setPrepJob] = useState<Job | null>(null);

  // Fetch jobs on mount and when filters change
  useEffect(() => {
    fetchJobs();
  }, [
    filters.page,
    filters.status,
    filters.sort_by,
    filters.sort_order,
    filters.search,
    filters.posted_within_hours,
  ]);

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

  const handleBatchPrepComplete = () => {
    // Refresh jobs and stats after batch prep
    fetchJobs();
    fetchStats();
  };

  const handleSearchAllComplete = () => {
    // Refresh jobs and stats after batch search
    fetchJobs();
    fetchStats();
  };

  const handleDeleteByStatusComplete = () => {
    // Refresh jobs and stats after batch delete
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
          <p className="text-muted-foreground">View and manage jobs from your searches</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button>
              Actions
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setIsSearchModalOpen(true)}>
              <Search className="mr-2 h-4 w-4" />
              Search Jobs
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setIsSearchAllModalOpen(true)}>
              <Globe className="mr-2 h-4 w-4" />
              Search All Profiles
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setIsBatchPrepModalOpen(true)}>
              <Layers className="mr-2 h-4 w-4" />
              Prep All Jobs
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setIsDeleteByStatusModalOpen(true)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete by Status
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleRefresh}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Stats */}
      <JobStatsCard stats={stats} isLoading={statsLoading} />

      {/* Filters */}
      <JobFilters filters={filters} onFiltersChange={setFilters} onReset={resetFilters} />

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

      {/* Batch Prep Modal */}
      <BatchPrepModal
        isOpen={isBatchPrepModalOpen}
        onClose={() => setIsBatchPrepModalOpen(false)}
        onComplete={handleBatchPrepComplete}
      />

      {/* Search All Profiles Modal */}
      <SearchAllJobsModal
        isOpen={isSearchAllModalOpen}
        onClose={() => setIsSearchAllModalOpen(false)}
        onComplete={handleSearchAllComplete}
      />

      {/* Delete by Status Modal */}
      <DeleteByStatusModal
        isOpen={isDeleteByStatusModalOpen}
        onClose={() => setIsDeleteByStatusModalOpen(false)}
        onComplete={handleDeleteByStatusComplete}
        stats={stats}
      />
    </div>
  );
}
