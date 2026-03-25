"use client";

import { PageHeader } from "@/components/shared/layout";
import {
  JobTable,
  JobFilters,
  JobDetailModal,
  JobStatsCard,
  ManualAnalyzeModal,
  PrepJobModal,
} from "@/components/shared/jobs";
import {
  ManualJobModal,
  BatchPrepModal,
  DeleteByStatusModal,
  useJobsListScreen,
} from "@/components/screens/dashboard/jobs/list";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui";
import { RefreshCw, ChevronDown, Layers, Trash2, Plus } from "lucide-react";

export default function JobsListPage() {
  const screen = useJobsListScreen();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Job Listings"
        description="View and manage jobs from external ingest and manual entry"
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                Actions
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => screen.setIsManualJobModalOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Manual Job
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => screen.setIsBatchPrepModalOpen(true)}>
                <Layers className="mr-2 h-4 w-4" />
                Prep Analyzed Jobs
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => screen.setIsDeleteByStatusModalOpen(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete by Status
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={screen.refresh}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      {/* Stats */}
      <JobStatsCard stats={screen.stats} isLoading={screen.statsLoading} />

      {/* Filters */}
      <JobFilters
        filters={screen.filters}
        onFiltersChange={screen.setFilters}
        onReset={screen.resetFilters}
      />

      {/* Job Table */}
      <JobTable
        jobs={screen.jobs}
        total={screen.total}
        page={screen.filters.page || 1}
        pageSize={screen.filters.page_size || 20}
        isLoading={screen.isLoading}
        preppingJobId={screen.preppingJobId}
        onJobClick={screen.handleJobClick}
        onDelete={screen.handleDelete}
        onAnalyze={screen.handleAnalyze}
        onPrep={screen.handlePrep}
        onPageChange={screen.goToPage}
        onSort={screen.handleSort}
      />

      {/* Detail Modal */}
      <JobDetailModal
        job={screen.selectedJob}
        isOpen={screen.isDetailModalOpen}
        onClose={screen.handleCloseDetailModal}
        onJobChange={screen.setSelectedJob}
        onUpdate={screen.updateJobStatus}
        onDelete={screen.handleDelete}
        onAnalyze={screen.handleAnalyze}
        onPrep={screen.handlePrep}
      />

      {/* Manual Job Modal */}
      <ManualJobModal
        isOpen={screen.isManualJobModalOpen}
        onClose={() => screen.setIsManualJobModalOpen(false)}
        onComplete={screen.refresh}
      />

      <ManualAnalyzeModal
        job={screen.analyzeJob}
        isOpen={screen.isManualAnalyzeModalOpen}
        onClose={screen.handleCloseManualAnalyzeModal}
        onComplete={screen.handleManualAnalyzeComplete}
      />

      {/* Prep Modal */}
      <PrepJobModal
        job={screen.prepJob}
        isOpen={screen.isPrepModalOpen}
        onClose={screen.handleClosePrepModal}
        onComplete={screen.handlePrepComplete}
      />

      {/* Batch Prep Modal */}
      <BatchPrepModal
        isOpen={screen.isBatchPrepModalOpen}
        onClose={() => screen.setIsBatchPrepModalOpen(false)}
        onComplete={screen.refresh}
      />

      {/* Delete by Status Modal */}
      <DeleteByStatusModal
        isOpen={screen.isDeleteByStatusModalOpen}
        onClose={() => screen.setIsDeleteByStatusModalOpen(false)}
        onComplete={screen.refresh}
        stats={screen.stats}
      />
    </div>
  );
}
