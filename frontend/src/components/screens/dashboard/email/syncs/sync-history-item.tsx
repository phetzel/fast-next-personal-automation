import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { EmailSync } from "@/types";
import { CheckCircle, Clock, Loader2, XCircle } from "lucide-react";

interface SyncHistoryItemProps {
  sync: EmailSync;
  isSelected: boolean;
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString();
}

function formatDuration(sync: EmailSync) {
  if (!sync.completed_at) return "In progress";
  const start = new Date(sync.started_at);
  const end = new Date(sync.completed_at);
  const diffMs = end.getTime() - start.getTime();
  const diffSecs = Math.floor(diffMs / 1000);

  if (diffSecs < 60) {
    return `${diffSecs}s`;
  }

  const diffMins = Math.floor(diffSecs / 60);
  return `${diffMins}m ${diffSecs % 60}s`;
}

function SyncStatusBadge({ status }: { status: EmailSync["status"] }) {
  switch (status) {
    case "completed":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
          <CheckCircle className="h-3 w-3" />
          Completed
        </span>
      );
    case "failed":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-600 dark:text-red-400">
          <XCircle className="h-3 w-3" />
          Failed
        </span>
      );
    case "running":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
          <Loader2 className="h-3 w-3 animate-spin" />
          Running
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
          <Clock className="h-3 w-3" />
          Pending
        </span>
      );
  }
}

export function SyncHistoryItem({ sync, isSelected }: SyncHistoryItemProps) {
  return (
    <AccordionItem
      value={sync.id}
      className={cn(
        "bg-card rounded-lg border px-4 transition-all",
        "hover:ring-primary/20 hover:shadow-md hover:ring-2",
        isSelected && "ring-primary ring-2"
      )}
    >
      <AccordionTrigger className="hover:no-underline">
        <div className="flex items-center gap-4">
          <SyncStatusBadge status={sync.status} />
          <div>
            <p className="font-medium">{formatDate(sync.started_at)}</p>
            <p className="text-muted-foreground text-sm">Duration: {formatDuration(sync)}</p>
          </div>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div className="text-center">
            <p className="font-bold">{sync.sources_synced}</p>
            <p className="text-muted-foreground">Sources</p>
          </div>
          <div className="text-center">
            <p className="font-bold">{sync.emails_fetched}</p>
            <p className="text-muted-foreground">Fetched</p>
          </div>
          <div className="text-center">
            <p className="font-bold">{sync.emails_processed}</p>
            <p className="text-muted-foreground">Processed</p>
          </div>
          <div className="text-center">
            <p className="font-bold">{sync.sync_metadata?.jobs_saved || 0}</p>
            <p className="text-muted-foreground">Jobs</p>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="border-t pt-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-medium">Sync Details</p>
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">ID:</dt>
                <dd className="font-mono text-xs">{sync.id}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Started:</dt>
                <dd>{formatDate(sync.started_at)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Completed:</dt>
                <dd>{sync.completed_at ? formatDate(sync.completed_at) : "N/A"}</dd>
              </div>
            </dl>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Job Statistics</p>
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Extracted:</dt>
                <dd>{sync.sync_metadata?.jobs_extracted || 0}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Analyzed:</dt>
                <dd>{sync.sync_metadata?.jobs_analyzed || 0}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Saved:</dt>
                <dd>{sync.sync_metadata?.jobs_saved || 0}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">High Scoring:</dt>
                <dd>{sync.sync_metadata?.high_scoring || 0}</dd>
              </div>
            </dl>
          </div>
        </div>
        {sync.error_message && (
          <div className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
            <p className="font-medium">Error:</p>
            <p className="mt-1">{sync.error_message}</p>
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}
