"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { PageHeader } from "@/components/shared/layout";
import { PipelineList } from "@/components/shared/pipelines";
import { Card, CardContent } from "@/components/ui";
import { Workflow, Briefcase, Sparkles } from "lucide-react";

export default function JobPipelinesPage() {
  const searchParams = useSearchParams();

  // Read pipeline and initial values from URL params
  const expandedPipeline = searchParams.get("pipeline") || undefined;
  const initialValues = useMemo(() => {
    const values: Record<string, unknown> = {};
    const jobId = searchParams.get("job_id");
    if (jobId) {
      values.job_id = jobId;
    }
    const profileId = searchParams.get("profile_id");
    if (profileId) {
      values.profile_id = profileId;
    }
    return Object.keys(values).length > 0 ? values : undefined;
  }, [searchParams]);
  return (
    <div className="space-y-6">
      <PageHeader title="Job Pipelines" description="Run internal prep pipelines for saved jobs" />

      {/* Info Card */}
      <Card className="border-green-500/20 bg-green-500/5">
        <CardContent className="flex items-start gap-4 py-4">
          <div className="rounded-full bg-green-500/10 p-2">
            <Workflow className="h-5 w-5 text-green-600" />
          </div>
          <div className="space-y-1">
            <h3 className="font-medium">Job Pipelines</h3>
            <p className="text-muted-foreground text-sm">
              These pipelines help you prep saved jobs for applications. Select a pipeline below to
              get started.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Job-specific pipelines */}
      <PipelineList
        area="jobs"
        showFilters={false}
        expandedPipeline={expandedPipeline}
        initialValues={initialValues}
      />

      {/* How it works */}
      <Card>
        <CardContent className="py-6">
          <h3 className="mb-4 flex items-center gap-2 font-semibold">
            <Sparkles className="text-primary h-4 w-4" />
            How Job Pipelines Work
          </h3>
          <ul className="text-muted-foreground space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <Briefcase className="text-primary mt-0.5 h-4 w-4" />
              <span>
                <strong className="text-foreground">Profile Recommended:</strong> Make sure you have
                a job profile with a linked resume before running prep pipelines.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Workflow className="text-primary mt-0.5 h-4 w-4" />
              <span>
                <strong className="text-foreground">Analysis First:</strong> Jobs should be in the
                analyzed stage before prep so the app knows whether to write a cover letter and
                which questions to answer.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Sparkles className="text-primary mt-0.5 h-4 w-4" />
              <span>
                <strong className="text-foreground">Prep Output:</strong> Prep always writes notes,
                generates question answers when present, and only writes a cover letter when
                required or explicitly forced.
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
