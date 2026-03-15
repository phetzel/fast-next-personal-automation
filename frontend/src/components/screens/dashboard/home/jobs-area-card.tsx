"use client";

import { StatPill } from "@/components/shared/navigation";
import { Skeleton } from "@/components/ui";
import { ROUTES } from "@/lib/constants";
import type { JobStats } from "@/types";
import { Briefcase, FileText, PhoneCall, Search, Send, Sparkles, TrendingUp } from "lucide-react";
import { AreaOverviewCardShell } from "./area-overview-card-shell";

interface JobsAreaCardProps {
  stats: JobStats | null;
  loading: boolean;
}

export function JobsAreaCard({ stats, loading }: JobsAreaCardProps) {
  const actionNeeded = (stats?.new ?? 0) + (stats?.analyzed ?? 0) + (stats?.prepped ?? 0);

  return (
    <AreaOverviewCardShell
      href={ROUTES.JOBS}
      title="Jobs"
      description="Job search & applications"
      icon={Briefcase}
      tone="amber"
      stats={
        loading ? (
          <div className="grid grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-14 rounded-lg" />
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-5 gap-3">
            <StatPill icon={Sparkles} label="New" value={stats.new} tone="blue" />
            <StatPill
              icon={Search}
              label="Analyzed"
              value={stats.analyzed}
              tone="purple"
              highlight={stats.analyzed > 0}
            />
            <StatPill icon={FileText} label="Prepped" value={stats.prepped} tone="cyan" />
            <StatPill icon={Send} label="Applied" value={stats.applied} tone="green" />
            <StatPill
              icon={PhoneCall}
              label="Interview"
              value={stats.interviewing}
              tone="amber"
              highlight={stats.interviewing > 0}
            />
          </div>
        ) : (
          <div className="py-4 text-center">
            <p className="text-muted-foreground text-sm">No stats available</p>
          </div>
        )
      }
      footer={
        stats ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-muted-foreground">
                <span className="text-foreground font-medium">{stats.total}</span> total jobs
              </span>
              {stats.high_scoring > 0 ? (
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span className="font-medium">{stats.high_scoring}</span> high scoring
                </span>
              ) : null}
            </div>
            {actionNeeded > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                {actionNeeded} need review
              </span>
            ) : null}
          </div>
        ) : null
      }
    />
  );
}
