import Link from "next/link";
import { EmptyState } from "@/components/shared/feedback";
import { Button, Card, CardContent, CardHeader, CardTitle, Skeleton } from "@/components/ui";
import { ROUTES } from "@/lib/constants";
import type { EmailSync } from "@/types";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle,
  Clock,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";

interface RecentSyncsPanelProps {
  syncs: EmailSync[];
  isLoading: boolean;
  sourcesCount: number;
}

function getRelativeTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

function getStatusIcon(status: string) {
  switch (status) {
    case "completed":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-red-500" />;
    case "running":
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    default:
      return <Clock className="h-4 w-4 text-amber-500" />;
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    case "running":
      return "Running";
    default:
      return "Pending";
  }
}

export function RecentSyncsPanel({ syncs, isLoading, sourcesCount }: RecentSyncsPanelProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5 text-blue-500" />
          Recent Syncs
        </CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href={ROUTES.EMAIL_SYNCS}>
            View all
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : syncs.length === 0 ? (
          <EmptyState
            icon={AlertCircle}
            title="No syncs yet"
            description={
              sourcesCount === 0
                ? "Connect an email account to start syncing."
                : "Click 'Sync Now' to fetch new emails."
            }
          />
        ) : (
          <div className="space-y-3">
            {syncs.slice(0, 5).map((sync) => (
              <div
                key={sync.id}
                className="bg-card flex items-center justify-between rounded-lg border p-4"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(sync.status)}
                  <div>
                    <p className="font-medium">{getStatusLabel(sync.status)}</p>
                    <p className="text-muted-foreground text-sm">
                      {getRelativeTime(sync.started_at)}
                    </p>
                  </div>
                </div>
                <div className="text-muted-foreground flex items-center gap-6 text-sm">
                  <span>{sync.sources_synced} sources</span>
                  <span>{sync.emails_processed} emails</span>
                  <span>{sync.sync_metadata?.jobs_saved || 0} jobs</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
