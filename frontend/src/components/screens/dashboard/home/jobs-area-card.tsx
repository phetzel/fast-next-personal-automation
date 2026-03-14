"use client";

import { useEffect } from "react";
import Link from "next/link";
import { StatPill } from "@/components/shared/navigation";
import { Card, CardContent, Skeleton } from "@/components/ui";
import { useJobs } from "@/hooks";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  Briefcase,
  Sparkles,
  Search,
  FileText,
  Send,
  PhoneCall,
  ArrowRight,
  TrendingUp,
} from "lucide-react";

/**
 * Jobs area card for the main dashboard.
 * Shows key job search stats and provides quick access to the Jobs area.
 */
export function JobsAreaCard() {
  const { stats, statsLoading, fetchStats } = useJobs();

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Calculate "action needed" count - jobs that need attention
  const actionNeeded = (stats?.new ?? 0) + (stats?.analyzed ?? 0) + (stats?.prepped ?? 0);

  return (
    <Link href={ROUTES.JOBS} className="group block">
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
            "bg-gradient-to-br from-amber-500/5 via-transparent to-orange-500/5",
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
                  "bg-amber-500/10 text-amber-600",
                  "dark:bg-amber-500/20 dark:text-amber-400"
                )}
              >
                <Briefcase className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold tracking-tight">Jobs</h3>
                <p className="text-muted-foreground text-sm">Job search & applications</p>
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
          {statsLoading ? (
            <div className="grid grid-cols-5 gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
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
          )}

          {/* Footer Summary */}
          {stats && (
            <div className="border-border/50 mt-4 flex items-center justify-between border-t pt-4 text-sm">
              <div className="flex items-center gap-4">
                <span className="text-muted-foreground">
                  <span className="text-foreground font-medium">{stats.total}</span> total jobs
                </span>
                {stats.high_scoring > 0 && (
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span className="font-medium">{stats.high_scoring}</span> high scoring
                  </span>
                )}
              </div>
              {actionNeeded > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                  {actionNeeded} need review
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
