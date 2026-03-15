"use client";

import { PageHeader } from "@/components/shared/layout";
import {
  JobTable,
  JobFilters,
  JobDetailModal,
  JobStatsCard,
  PrepJobModal,
} from "@/components/shared/jobs";
import {
  SearchJobsModal,
  SearchAllJobsModal,
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
import { RefreshCw, Search, ChevronDown, Layers, Globe, Trash2, Plus } from "lucide-react";

export default function JobsListPage() {
  const screen = useJobsListScreen();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Job Listings"
        description="View and manage jobs from your searches"
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                Actions
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => screen.setIsSearchModalOpen(true)}>
                <Search className="mr-2 h-4 w-4" />
                Search Jobs
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => screen.setIsManualJobModalOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Manual Job
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => screen.setIsSearchAllModalOpen(true)}>
                <Globe className="mr-2 h-4 w-4" />
                Search All Profiles
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
        onPrep={screen.handlePrep}
      />

      {/* Search Modal */}
      <SearchJobsModal
        isOpen={screen.isSearchModalOpen}
        onClose={() => screen.setIsSearchModalOpen(false)}
        onComplete={screen.refresh}
      />

      {/* Manual Job Modal */}
      <ManualJobModal
        isOpen={screen.isManualJobModalOpen}
        onClose={() => screen.setIsManualJobModalOpen(false)}
        onComplete={screen.refresh}
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

      {/* Search All Profiles Modal */}
      <SearchAllJobsModal
        isOpen={screen.isSearchAllModalOpen}
        onClose={() => screen.setIsSearchAllModalOpen(false)}
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
