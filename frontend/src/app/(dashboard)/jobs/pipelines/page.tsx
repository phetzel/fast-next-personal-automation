"use client";

import { PipelineList } from "@/components/pipelines";
import { Card, CardContent } from "@/components/ui";
import { Workflow, Briefcase, Sparkles } from "lucide-react";

export default function JobPipelinesPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Job Pipelines</h1>
        <p className="text-muted-foreground">
          Run automated pipelines for job search and analysis
        </p>
      </div>

      {/* Info Card */}
      <Card className="border-green-500/20 bg-green-500/5">
        <CardContent className="flex items-start gap-4 py-4">
          <div className="rounded-full bg-green-500/10 p-2">
            <Workflow className="h-5 w-5 text-green-600" />
          </div>
          <div className="space-y-1">
            <h3 className="font-medium">Job Pipelines</h3>
            <p className="text-sm text-muted-foreground">
              These pipelines are designed to help you find and analyze job opportunities.
              Select a pipeline below to get started.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Job-specific pipelines */}
      <PipelineList area="jobs" showFilters={false} />

      {/* How it works */}
      <Card>
        <CardContent className="py-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            How Job Pipelines Work
          </h3>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <Briefcase className="h-4 w-4 mt-0.5 text-primary" />
              <span>
                <strong className="text-foreground">Profile Required:</strong> Make sure you have a job profile 
                with a linked resume before running pipelines.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Workflow className="h-4 w-4 mt-0.5 text-primary" />
              <span>
                <strong className="text-foreground">Smart Matching:</strong> AI analyzes each job against 
                your resume and target roles to calculate a relevance score.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Sparkles className="h-4 w-4 mt-0.5 text-primary" />
              <span>
                <strong className="text-foreground">Automatic Filtering:</strong> Only jobs above your 
                minimum score threshold are saved, unless you enable &quot;save all&quot;.
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

