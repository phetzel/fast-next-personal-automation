"use client";

import { StatPill } from "@/components/shared/navigation";
import { Skeleton } from "@/components/ui";
import { ROUTES } from "@/lib/constants";
import { formatRelativeTime } from "@/lib/formatters";
import type { EmailSyncStats } from "@/types";
import { AlertCircle, CheckCircle, Inbox, Mail, RefreshCw, Server, XCircle } from "lucide-react";
import { AreaOverviewCardShell } from "./area-overview-card-shell";

interface EmailAreaCardProps {
  stats: EmailSyncStats | null;
  sourcesCount: number;
  loading: boolean;
}

function getSyncStatusDisplay(stats: EmailSyncStats | null) {
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
}

export function EmailAreaCard({ stats, sourcesCount, loading }: EmailAreaCardProps) {
  const syncStatus = getSyncStatusDisplay(stats);
  const SyncIcon = syncStatus.icon;

  return (
    <AreaOverviewCardShell
      href={ROUTES.EMAIL}
      title="Email"
      description="Email sync & processing"
      icon={Mail}
      tone="blue"
      stats={
        loading ? (
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-14 rounded-lg" />
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-4 gap-3">
            <StatPill
              icon={Server}
              label="Sources"
              value={sourcesCount}
              tone="blue"
              highlight={sourcesCount === 0}
            />
            <StatPill icon={RefreshCw} label="Syncs" value={stats.total_syncs} tone="cyan" />
            <StatPill
              icon={Inbox}
              label="Emails"
              value={stats.total_emails_processed}
              tone="green"
            />
            <StatPill
              icon={CheckCircle}
              label="Jobs"
              value={stats.total_jobs_saved}
              tone="amber"
              highlight={stats.total_jobs_saved > 0}
            />
          </div>
        ) : (
          <div className="py-4 text-center">
            <p className="text-muted-foreground text-sm">No stats available</p>
          </div>
        )
      }
      footer={
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SyncIcon className={`h-4 w-4 ${syncStatus.color}`} />
            <span className="text-muted-foreground">
              {stats?.last_sync
                ? `Last sync ${formatRelativeTime(stats.last_sync.started_at)}`
                : syncStatus.label}
            </span>
          </div>
          {sourcesCount === 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
              Connect email
            </span>
          ) : stats && stats.failed_syncs > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-600 dark:text-red-400">
              {stats.failed_syncs} failed
            </span>
          ) : null}
        </div>
      }
    />
  );
}
