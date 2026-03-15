"use client";

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  ScrollArea,
} from "@/components/ui";
import { formatDateTime, formatDuration } from "@/lib/formatters";
import { RunStatusBadge } from "./run-status-badge";
import { TriggerBadge } from "./trigger-badge";
import type { PipelineRun } from "@/types";
import { X, Clock, Calendar, FileJson, AlertCircle } from "lucide-react";

interface RunDetailModalProps {
  run: PipelineRun;
  onClose: () => void;
}

function JsonViewer({ data, label }: { data: Record<string, unknown> | null; label: string }) {
  if (!data || Object.keys(data).length === 0) {
    return <div className="text-muted-foreground text-sm italic">No {label.toLowerCase()}</div>;
  }

  return (
    <ScrollArea className="max-h-64 rounded-lg border">
      <pre className="bg-muted p-3 text-xs">
        <code>{JSON.stringify(data, null, 2)}</code>
      </pre>
    </ScrollArea>
  );
}

export function RunDetailModal({ run, onClose }: RunDetailModalProps) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="flex flex-row items-start justify-between gap-4 border-b pr-8 pb-4">
          <div>
            <DialogTitle>{run.pipeline_name}</DialogTitle>
            <p className="text-muted-foreground text-sm">Run ID: {run.id.slice(0, 8)}...</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-6">
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
                  <p className="text-sm font-medium">{formatDateTime(run.created_at)}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Clock className="text-muted-foreground mt-0.5 h-4 w-4" />
                <div>
                  <p className="text-muted-foreground text-xs">Started</p>
                  <p className="text-sm font-medium">{formatDateTime(run.started_at)}</p>
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
                  <pre className="text-sm break-words whitespace-pre-wrap text-red-600">
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
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
