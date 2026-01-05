"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui";
import { useEmailSyncs } from "@/hooks";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  Mail,
  RefreshCw,
  Inbox,
  Server,
  ArrowRight,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";

/**
 * Email area card for the main dashboard.
 * Shows email sync stats and provides quick access to the Email area.
 */
export function EmailAreaCard() {
  const { stats, sources, isLoading, calculateStats } = useEmailSyncs();

  useEffect(() => {
    calculateStats();
  }, []);

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

  // Determine sync status icon and color
  const getSyncStatusDisplay = () => {
    if (!stats?.last_sync) {
      return { icon: AlertCircle, color: "text-muted-foreground", label: "No syncs yet" };
    }
    if (stats.last_sync.status === "completed") {
      return { icon: CheckCircle, color: "text-green-500", label: "Last sync successful" };
    }
    if (stats.last_sync.status === "failed") {
      return { icon: XCircle, color: "text-red-500", label: "Last sync failed" };
    }
    if (stats.last_sync.status === "running") {
      return { icon: RefreshCw, color: "text-blue-500 animate-spin", label: "Syncing..." };
    }
    return { icon: AlertCircle, color: "text-amber-500", label: "Sync pending" };
  };

  const syncStatus = getSyncStatusDisplay();
  const SyncIcon = syncStatus.icon;

  return (
    <Link href={ROUTES.EMAIL} className="group block">
      <Card
        className={cn(
          "relative overflow-hidden transition-all duration-300",
          "hover:ring-primary/20 hover:shadow-lg hover:ring-2",
          "hover:-translate-y-0.5"
        )}
      >
        {/* Decorative gradient background */}
        <div
          className={cn(
            "absolute inset-0 opacity-0 transition-opacity duration-300",
            "bg-gradient-to-br from-blue-500/5 via-transparent to-indigo-500/5",
            "group-hover:opacity-100"
          )}
        />

        <CardContent className="relative p-6">
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "rounded-xl p-3 transition-colors",
                  "bg-blue-500/10 text-blue-600",
                  "dark:bg-blue-500/20 dark:text-blue-400"
                )}
              >
                <Mail className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold tracking-tight">Email</h3>
                <p className="text-muted-foreground text-sm">Email sync & processing</p>
              </div>
            </div>
            <ArrowRight
              className={cn(
                "text-muted-foreground h-5 w-5 transition-transform",
                "group-hover:text-primary group-hover:translate-x-1"
              )}
            />
          </div>

          {/* Stats Grid */}
          {isLoading ? (
            <div className="grid grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-muted h-14 animate-pulse rounded-lg" />
              ))}
            </div>
          ) : stats ? (
            <div className="grid grid-cols-4 gap-3">
              <StatPill
                icon={Server}
                label="Sources"
                value={sources.length}
                color="blue"
                highlight={sources.length === 0}
              />
              <StatPill icon={RefreshCw} label="Syncs" value={stats.total_syncs} color="cyan" />
              <StatPill
                icon={Inbox}
                label="Emails"
                value={stats.total_emails_processed}
                color="green"
              />
              <StatPill
                icon={CheckCircle}
                label="Jobs"
                value={stats.total_jobs_saved}
                color="amber"
                highlight={stats.total_jobs_saved > 0}
              />
            </div>
          ) : (
            <div className="py-4 text-center">
              <p className="text-muted-foreground text-sm">No stats available</p>
            </div>
          )}

          {/* Footer Summary */}
          <div className="border-border/50 mt-4 flex items-center justify-between border-t pt-4 text-sm">
            <div className="flex items-center gap-2">
              <SyncIcon className={cn("h-4 w-4", syncStatus.color)} />
              <span className="text-muted-foreground">
                {stats?.last_sync
                  ? `Last sync ${getRelativeTime(stats.last_sync.started_at)}`
                  : syncStatus.label}
              </span>
            </div>
            {sources.length === 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                Connect email
              </span>
            )}
            {stats && stats.failed_syncs > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-600 dark:text-red-400">
                {stats.failed_syncs} failed
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

interface StatPillProps {
  icon: typeof Mail;
  label: string;
  value: number;
  color: "blue" | "cyan" | "green" | "amber" | "purple";
  highlight?: boolean;
}

const colorStyles = {
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  cyan: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  green: "bg-green-500/10 text-green-600 dark:text-green-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
};

function StatPill({ icon: Icon, label, value, color, highlight }: StatPillProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1 rounded-lg px-1 py-2 transition-colors",
        colorStyles[color],
        highlight && "ring-1 ring-current/20"
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="text-lg leading-none font-bold">{value}</span>
      <span className="text-[10px] tracking-wider uppercase opacity-80">{label}</span>
    </div>
  );
}
