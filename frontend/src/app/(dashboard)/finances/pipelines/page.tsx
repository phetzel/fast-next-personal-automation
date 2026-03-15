"use client";

import { PageHeader } from "@/components/shared/layout";
import { PipelineList } from "@/components/shared/pipelines";
import { Card, CardContent } from "@/components/ui";
import { Workflow, Mail, Sparkles, Tag } from "lucide-react";

export default function FinancePipelinesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance Pipelines"
        description="Run automated pipelines to import and organize your financial data"
      />

      {/* Info Card */}
      <Card className="border-violet-500/20 bg-violet-500/5">
        <CardContent className="flex items-start gap-4 py-4">
          <div className="rounded-full bg-violet-500/10 p-2">
            <Workflow className="h-5 w-5 text-violet-600" />
          </div>
          <div className="space-y-1">
            <h3 className="font-medium">Finance Pipelines</h3>
            <p className="text-muted-foreground text-sm">
              These pipelines automate syncing transactions from your email and categorizing them
              with AI. Schedule them via the Schedules page to keep your finances up to date
              automatically.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Finance-specific pipelines */}
      <PipelineList area="finances" showFilters={false} />

      {/* How it works */}
      <Card>
        <CardContent className="py-6">
          <h3 className="mb-4 flex items-center gap-2 font-semibold">
            <Sparkles className="text-primary h-4 w-4" />
            How Finance Pipelines Work
          </h3>
          <ul className="text-muted-foreground space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <Mail className="text-primary mt-0.5 h-4 w-4" />
              <span>
                <strong className="text-foreground">Email Sync:</strong> Connects to your Gmail and
                scans for bank alerts, receipts, and billing emails. AI extracts transaction details
                and imports them — only scanning since your last sync.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Tag className="text-primary mt-0.5 h-4 w-4" />
              <span>
                <strong className="text-foreground">Auto-Categorize:</strong> Reviews uncategorized
                transactions in batches and assigns categories using AI based on merchant names and
                descriptions.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Workflow className="text-primary mt-0.5 h-4 w-4" />
              <span>
                <strong className="text-foreground">Schedule It:</strong> Head to the{" "}
                <strong className="text-foreground">Schedules</strong> page to run these pipelines
                automatically on a recurring basis (e.g., email sync every 6 hours, categorize
                nightly).
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
