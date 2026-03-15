"use client";

import { useJobsOverviewScreen } from "@/components/screens/dashboard/jobs/overview";
import { JobStatsCard, JobCard, JobDetailModal } from "@/components/shared/jobs";
import { PageHeader, SectionCard } from "@/components/shared/layout";
import { FeatureLinkCard } from "@/components/shared/navigation";
import { Button, Skeleton } from "@/components/ui";
import { ROUTES } from "@/lib/constants";
import Link from "next/link";
import { LayoutList, Workflow, UserCircle, ArrowRight, Sparkles } from "lucide-react";

export default function JobsOverviewPage() {
  const screen = useJobsOverviewScreen();

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
      <JobStatsCard stats={screen.stats} isLoading={screen.statsLoading} />

      {/* Recent Jobs */}
      <SectionCard
        title={
          <span className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Recent Matches
          </span>
        }
        actions={
          <Button variant="ghost" size="sm" asChild>
            <Link href={ROUTES.JOBS_LIST}>
              View all
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        }
      >
        {screen.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-lg" />
            ))}
          </div>
        ) : screen.jobs.slice(0, 6).length === 0 ? (
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
            {screen.jobs.slice(0, 6).map((job) => (
              <JobCard key={job.id} job={job} onClick={() => screen.handleJobClick(job)} />
            ))}
          </div>
        )}
      </SectionCard>

      {/* Detail Modal */}
      <JobDetailModal
        job={screen.selectedJob}
        isOpen={screen.isModalOpen}
        onClose={screen.handleCloseModal}
        onJobChange={screen.setSelectedJob}
        onUpdate={screen.updateJobStatus}
        onDelete={screen.deleteJob}
      />
    </div>
  );
}
