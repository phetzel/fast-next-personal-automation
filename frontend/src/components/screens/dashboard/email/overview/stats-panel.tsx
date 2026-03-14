import Link from "next/link";
import { EmptyState } from "@/components/shared/feedback";
import { MetricCard } from "@/components/shared/navigation";
import { Button, Card, CardContent, CardHeader, CardTitle, Skeleton } from "@/components/ui";
import { ROUTES } from "@/lib/constants";
import type { EmailSyncStats } from "@/types";
import { AlertCircle, CheckCircle, Inbox, Mail, RefreshCw, Server, Settings } from "lucide-react";

interface EmailOverviewStatsPanelProps {
  stats: EmailSyncStats | null;
  sourcesCount: number;
  isLoading: boolean;
}

export function EmailOverviewStatsPanel({
  stats,
  sourcesCount,
  isLoading,
}: EmailOverviewStatsPanelProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-20 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card>
        <CardContent>
          <EmptyState
            icon={AlertCircle}
            title="No statistics available"
            description="Connect an email account or trigger a sync to populate metrics."
            action={
              sourcesCount === 0 ? (
                <Button asChild>
                  <Link href={ROUTES.SETTINGS_EMAIL}>
                    <Settings className="mr-2 h-4 w-4" />
                    Connect Email Account
                  </Link>
                </Button>
              ) : undefined
            }
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-blue-500" />
          Sync Statistics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          <MetricCard title="Connected Sources" value={sourcesCount} icon={Server} tone="blue" />
          <MetricCard title="Total Syncs" value={stats.total_syncs} icon={RefreshCw} tone="cyan" />
          <MetricCard
            title="Emails Processed"
            value={stats.total_emails_processed}
            icon={Inbox}
            tone="green"
          />
          <MetricCard
            title="Jobs Found"
            value={stats.total_jobs_saved}
            icon={CheckCircle}
            tone="amber"
          />
        </div>
      </CardContent>
    </Card>
  );
}
