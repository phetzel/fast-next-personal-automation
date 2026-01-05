"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useJobs } from "@/hooks";
import { JobStatsCard, JobCard, JobDetailModal } from "@/components/jobs";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { ROUTES } from "@/lib/constants";
import type { Job } from "@/types";
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
  }, []);

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
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Jobs Overview</h1>
        <p className="text-muted-foreground">
          Your job search dashboard with quick access to everything
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Link href={ROUTES.JOBS_LIST} className="block">
          <Card className="hover:ring-primary/20 h-full transition-all hover:shadow-md hover:ring-2">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-lg bg-blue-500/10 p-3">
                <LayoutList className="h-6 w-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">View All Jobs</h3>
                <p className="text-muted-foreground text-sm">Browse and filter job listings</p>
              </div>
              <ArrowRight className="text-muted-foreground h-5 w-5" />
            </CardContent>
          </Card>
        </Link>

        <Link href={ROUTES.JOBS_PIPELINES} className="block">
          <Card className="hover:ring-primary/20 h-full transition-all hover:shadow-md hover:ring-2">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-lg bg-green-500/10 p-3">
                <Workflow className="h-6 w-6 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Run Pipelines</h3>
                <p className="text-muted-foreground text-sm">Search for jobs and more</p>
              </div>
              <ArrowRight className="text-muted-foreground h-5 w-5" />
            </CardContent>
          </Card>
        </Link>

        <Link href={ROUTES.JOBS_PROFILES} className="block">
          <Card className="hover:ring-primary/20 h-full transition-all hover:shadow-md hover:ring-2">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-lg bg-purple-500/10 p-3">
                <UserCircle className="h-6 w-6 text-purple-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Manage Profiles</h3>
                <p className="text-muted-foreground text-sm">Configure search profiles</p>
              </div>
              <ArrowRight className="text-muted-foreground h-5 w-5" />
            </CardContent>
          </Card>
        </Link>
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
                <div key={i} className="bg-muted h-48 animate-pulse rounded-lg" />
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
        onUpdate={updateJobStatus}
        onDelete={deleteJob}
      />
    </div>
  );
}
