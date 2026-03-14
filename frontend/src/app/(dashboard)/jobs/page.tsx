"use client";

import { useEffect, useState } from "react";
import { useJobs } from "@/hooks";
import { JobStatsCard, JobCard, JobDetailModal } from "@/components/shared/jobs";
import { PageHeader } from "@/components/shared/layout";
import { FeatureLinkCard } from "@/components/shared/navigation";
import { Button, Card, CardContent, CardHeader, CardTitle, Skeleton } from "@/components/ui";
import { ROUTES } from "@/lib/constants";
import type { Job } from "@/types";
import Link from "next/link";
import { LayoutList, Workflow, UserCircle, ArrowRight, Sparkles } from "lucide-react";

export default function JobsOverviewPage() {
  const {
    jobs,
    isLoading,
    stats,
    statsLoading,
    selectedJob,
    fetchJobs,
    fetchStats,
    updateJobStatus,
    deleteJob,
    setSelectedJob,
  } = useJobs();

  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch recent jobs and stats on mount
  useEffect(() => {
    // Fetch only recent jobs (limit to 6 for the overview)
    fetchJobs({ page: 1, page_size: 6, sort_by: "created_at", sort_order: "desc" });
    fetchStats();
  }, [fetchJobs, fetchStats]);

  const handleJobClick = (job: Job) => {
    setSelectedJob(job);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedJob(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jobs Overview"
        description="Your job search dashboard with quick access to everything"
      />

      {/* Quick Actions */}
      <div className="grid gap-4 sm:grid-cols-3">
        <FeatureLinkCard
          href={ROUTES.JOBS_LIST}
          icon={LayoutList}
          title="View All Jobs"
          description="Browse and filter job listings"
          tone="blue"
        />
        <FeatureLinkCard
          href={ROUTES.JOBS_PIPELINES}
          icon={Workflow}
          title="Run Pipelines"
          description="Search for jobs and more"
          tone="green"
        />
        <FeatureLinkCard
          href={ROUTES.JOBS_PROFILES}
          icon={UserCircle}
          title="Manage Profiles"
          description="Configure search profiles"
          tone="purple"
        />
      </div>

      {/* Stats */}
      <JobStatsCard stats={stats} isLoading={statsLoading} />

      {/* Recent Jobs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Recent Matches
          </CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href={ROUTES.JOBS_LIST}>
              View all
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-48 rounded-lg" />
              ))}
            </div>
          ) : jobs.slice(0, 6).length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">No jobs found yet</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Run a job search to find matching positions
              </p>
              <Button className="mt-4" asChild>
                <Link href={ROUTES.JOBS_PIPELINES}>
                  <Workflow className="mr-2 h-4 w-4" />
                  Run Job Search
                </Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {jobs.slice(0, 6).map((job) => (
                <JobCard key={job.id} job={job} onClick={() => handleJobClick(job)} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <JobDetailModal
        job={selectedJob}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onJobChange={setSelectedJob}
        onUpdate={updateJobStatus}
        onDelete={deleteJob}
      />
    </div>
  );
}
