"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { PipelineList } from "@/components/pipelines";
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
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Job Pipelines</h1>
        <p className="text-muted-foreground">Run automated pipelines for job search and analysis</p>
      </div>

      {/* Info Card */}
      <Card className="border-green-500/20 bg-green-500/5">
        <CardContent className="flex items-start gap-4 py-4">
          <div className="rounded-full bg-green-500/10 p-2">
            <Workflow className="h-5 w-5 text-green-600" />
          </div>
          <div className="space-y-1">
            <h3 className="font-medium">Job Pipelines</h3>
            <p className="text-muted-foreground text-sm">
              These pipelines are designed to help you find and analyze job opportunities. Select a
              pipeline below to get started.
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
                <strong className="text-foreground">Profile Required:</strong> Make sure you have a
                job profile with a linked resume before running pipelines.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Workflow className="text-primary mt-0.5 h-4 w-4" />
              <span>
                <strong className="text-foreground">Smart Matching:</strong> AI analyzes each job
                against your resume and target roles to calculate a relevance score.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Sparkles className="text-primary mt-0.5 h-4 w-4" />
              <span>
                <strong className="text-foreground">Automatic Filtering:</strong> Only jobs above
                your minimum score threshold are saved, unless you enable &quot;save all&quot;.
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
