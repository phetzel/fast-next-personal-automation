"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useEmailSyncs } from "@/hooks";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  RefreshCw,
  Inbox,
  Settings,
  ArrowRight,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Mail,
  Loader2,
  Server,
} from "lucide-react";

export default function EmailOverviewPage() {
  const { syncs, sources, stats, isLoading, isSyncing, fetchSyncs, calculateStats, triggerSync } =
    useEmailSyncs();

  // Fetch data on mount
  useEffect(() => {
    calculateStats();
    fetchSyncs(5);
  }, []);

  const handleTriggerSync = async () => {
    await triggerSync();
    calculateStats();
  };

  // Format relative time
  const getRelativeTime = (dateString: string) => {
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
  };

  const getStatusIcon = (status: string) => {
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
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Email Overview</h1>
          <p className="text-muted-foreground">Monitor email syncs and processing status</p>
        </div>
        <Button onClick={handleTriggerSync} disabled={isSyncing || sources.length === 0}>
          {isSyncing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync Now
            </>
          )}
        </Button>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href={ROUTES.EMAIL_SYNCS} className="block">
          <Card className="hover:ring-primary/20 h-full transition-all hover:shadow-md hover:ring-2">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-lg bg-blue-500/10 p-3">
                <RefreshCw className="h-6 w-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Sync History</h3>
                <p className="text-muted-foreground text-sm">View past sync operations</p>
              </div>
              <ArrowRight className="text-muted-foreground h-5 w-5" />
            </CardContent>
          </Card>
        </Link>

        <Link href={ROUTES.EMAIL_MESSAGES} className="block">
          <Card className="hover:ring-primary/20 h-full transition-all hover:shadow-md hover:ring-2">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-lg bg-green-500/10 p-3">
                <Inbox className="h-6 w-6 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Browse Messages</h3>
                <p className="text-muted-foreground text-sm">View processed emails</p>
              </div>
              <ArrowRight className="text-muted-foreground h-5 w-5" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Stats */}
      {isLoading ? (
        <Card>
          <CardContent className="p-6">
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-muted h-20 animate-pulse rounded-lg" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : stats ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-500" />
              Sync Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
              <StatCard
                label="Connected Sources"
                value={sources.length}
                icon={Server}
                color="blue"
              />
              <StatCard
                label="Total Syncs"
                value={stats.total_syncs}
                icon={RefreshCw}
                color="cyan"
              />
              <StatCard
                label="Emails Processed"
                value={stats.total_emails_processed}
                icon={Inbox}
                color="green"
              />
              <StatCard
                label="Jobs Found"
                value={stats.total_jobs_saved}
                icon={CheckCircle}
                color="amber"
              />
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
            <p className="text-muted-foreground">No statistics available</p>
            {sources.length === 0 && (
              <Button className="mt-4" asChild>
                <Link href={ROUTES.SETTINGS_EMAIL}>
                  <Settings className="mr-2 h-4 w-4" />
                  Connect Email Account
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent Syncs */}
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
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="bg-muted h-16 animate-pulse rounded-lg" />
              ))}
            </div>
          ) : syncs.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">No syncs yet</p>
              <p className="text-muted-foreground mt-1 text-sm">
                {sources.length === 0
                  ? "Connect an email account to start syncing"
                  : "Click 'Sync Now' to fetch new emails"}
              </p>
            </div>
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
                      <p className="font-medium">
                        {sync.status === "completed"
                          ? "Completed"
                          : sync.status === "failed"
                            ? "Failed"
                            : sync.status === "running"
                              ? "Running"
                              : "Pending"}
                      </p>
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
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  icon: typeof Mail;
  color: "blue" | "cyan" | "green" | "amber";
}

const colorStyles = {
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  cyan: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  green: "bg-green-500/10 text-green-600 dark:text-green-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

function StatCard({ label, value, icon: Icon, color }: StatCardProps) {
  return (
    <div className={cn("rounded-lg p-4", colorStyles[color])}>
      <div className="flex items-center justify-between">
        <Icon className="h-5 w-5" />
        <span className="text-2xl font-bold">{value}</span>
      </div>
      <p className="mt-2 text-sm opacity-80">{label}</p>
    </div>
  );
}
