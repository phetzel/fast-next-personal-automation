"use client";

import { Card, CardContent, CardHeader, CardTitle, Button } from "@/components/ui";
import { RunStatusBadge } from "./run-status-badge";
import { TriggerBadge } from "./trigger-badge";
import type { PipelineRun } from "@/types";
import { X, Clock, Calendar, FileJson, AlertCircle } from "lucide-react";

interface RunDetailModalProps {
  run: PipelineRun;
  onClose: () => void;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString();
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}m`;
}

function JsonViewer({ data, label }: { data: Record<string, unknown> | null; label: string }) {
  if (!data || Object.keys(data).length === 0) {
    return (
      <div className="text-muted-foreground text-sm italic">No {label.toLowerCase()}</div>
    );
  }

  return (
    <pre className="bg-muted scrollbar-thin max-h-64 overflow-auto rounded-lg p-3 text-xs">
      <code>{JSON.stringify(data, null, 2)}</code>
    </pre>
  );
}

export function RunDetailModal({ run, onClose }: RunDetailModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="bg-background scrollbar-thin relative z-10 max-h-[90vh] w-full max-w-2xl overflow-auto rounded-xl border shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-inherit px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">{run.pipeline_name}</h2>
            <p className="text-muted-foreground text-sm">
              Run ID: {run.id.slice(0, 8)}...
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="space-y-6 p-6">
          {/* Status and Trigger */}
          <div className="flex flex-wrap gap-3">
            <RunStatusBadge status={run.status} />
            <TriggerBadge trigger={run.trigger_type} />
          </div>

          {/* Timing Info */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex items-start gap-2">
              <Calendar className="text-muted-foreground mt-0.5 h-4 w-4" />
              <div>
                <p className="text-muted-foreground text-xs">Created</p>
                <p className="text-sm font-medium">{formatDate(run.created_at)}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Clock className="text-muted-foreground mt-0.5 h-4 w-4" />
              <div>
                <p className="text-muted-foreground text-xs">Started</p>
                <p className="text-sm font-medium">{formatDate(run.started_at)}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Clock className="text-muted-foreground mt-0.5 h-4 w-4" />
              <div>
                <p className="text-muted-foreground text-xs">Duration</p>
                <p className="text-sm font-medium">{formatDuration(run.duration_ms)}</p>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {run.error_message && (
            <Card className="border-red-500/30 bg-red-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  Error
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap break-words text-sm text-red-600">
                  {run.error_message}
                </pre>
              </CardContent>
            </Card>
          )}

          {/* Input Data */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <FileJson className="h-4 w-4" />
                Input Data
              </CardTitle>
            </CardHeader>
            <CardContent>
              <JsonViewer data={run.input_data} label="input" />
            </CardContent>
          </Card>

          {/* Output Data */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <FileJson className="h-4 w-4" />
                Output Data
              </CardTitle>
            </CardHeader>
            <CardContent>
              <JsonViewer data={run.output_data} label="output" />
            </CardContent>
          </Card>

          {/* Metadata */}
          {run.run_metadata && Object.keys(run.run_metadata).length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Metadata</CardTitle>
              </CardHeader>
              <CardContent>
                <JsonViewer data={run.run_metadata} label="metadata" />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

