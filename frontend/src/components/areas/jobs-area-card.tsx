"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui";
import { useJobs } from "@/hooks";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  Briefcase,
  Sparkles,
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
  }, []);

  // Calculate "action needed" count - jobs that need attention
  const actionNeeded = (stats?.new ?? 0) + (stats?.prepped ?? 0);
  const inProgress = (stats?.applied ?? 0) + (stats?.interviewing ?? 0);

  return (
    <Link href={ROUTES.JOBS} className="group block">
      <Card
        className={cn(
          "relative overflow-hidden transition-all duration-300",
          "hover:shadow-lg hover:ring-2 hover:ring-primary/20",
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
          <div className="flex items-center justify-between mb-4">
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
                <p className="text-sm text-muted-foreground">
                  Job search & applications
                </p>
              </div>
            </div>
            <ArrowRight
              className={cn(
                "h-5 w-5 text-muted-foreground transition-transform",
                "group-hover:translate-x-1 group-hover:text-primary"
              )}
            />
          </div>

          {/* Stats Grid */}
          {statsLoading ? (
            <div className="grid grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-14 animate-pulse rounded-lg bg-muted"
                />
              ))}
            </div>
          ) : stats ? (
            <div className="grid grid-cols-4 gap-3">
              <StatPill
                icon={Sparkles}
                label="New"
                value={stats.new}
                color="blue"
                highlight={stats.new > 0}
              />
              <StatPill
                icon={FileText}
                label="Prepped"
                value={stats.prepped}
                color="cyan"
              />
              <StatPill
                icon={Send}
                label="Applied"
                value={stats.applied}
                color="green"
              />
              <StatPill
                icon={PhoneCall}
                label="Interview"
                value={stats.interviewing}
                color="amber"
                highlight={stats.interviewing > 0}
              />
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">
                No stats available
              </p>
            </div>
          )}

          {/* Footer Summary */}
          {stats && (
            <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between text-sm">
              <div className="flex items-center gap-4">
                <span className="text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {stats.total}
                  </span>{" "}
                  total jobs
                </span>
                {stats.high_scoring > 0 && (
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span className="font-medium">{stats.high_scoring}</span>{" "}
                    high scoring
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

interface StatPillProps {
  icon: typeof Briefcase;
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
        "flex flex-col items-center gap-1 rounded-lg py-2 px-1 transition-colors",
        colorStyles[color],
        highlight && "ring-1 ring-current/20"
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="text-lg font-bold leading-none">{value}</span>
      <span className="text-[10px] uppercase tracking-wider opacity-80">
        {label}
      </span>
    </div>
  );
}

