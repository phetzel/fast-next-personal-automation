"use client";

import { Card, CardContent, Skeleton } from "@/components/ui";
import type { JobStats } from "@/types";
import { cn } from "@/lib/utils";
import {
  Briefcase,
  Sparkles,
  Search,
  FileText,
  Eye,
  Send,
  ThumbsDown,
  PhoneCall,
  Star,
  TrendingUp,
} from "lucide-react";

interface JobStatsCardProps {
  stats: JobStats | null;
  isLoading?: boolean;
  className?: string;
}

interface StatItemProps {
  label: string;
  value: number | string | null;
  Icon: typeof Briefcase;
  color: string;
}

interface StatSectionProps {
  title: string;
  items: StatItemProps[];
}

function StatItem({ label, value, Icon, color }: StatItemProps) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn("rounded-lg p-2", color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-2xl font-bold">{value ?? "-"}</p>
        <p className="text-muted-foreground text-xs">{label}</p>
      </div>
    </div>
  );
}

function StatSection({ title, items }: StatSectionProps) {
  return (
    <div className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-muted-foreground text-xs">Grouped by lifecycle stage</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <StatItem key={item.label} {...item} />
        ))}
      </div>
    </div>
  );
}

export function JobStatsCard({ stats, isLoading, className }: JobStatsCardProps) {
  const summaryStats: StatItemProps[] = [
    {
      label: "Total",
      value: stats?.total ?? 0,
      Icon: Briefcase,
      color: "bg-primary/10 text-primary",
    },
    {
      label: "High Score",
      value: stats?.high_scoring ?? 0,
      Icon: TrendingUp,
      color: "bg-emerald-500/10 text-emerald-600",
    },
    {
      label: "Avg Score",
      value: stats?.avg_score?.toFixed(1) ?? "-",
      Icon: Star,
      color: "bg-yellow-500/10 text-yellow-600",
    },
  ];

  const preAppliedStats: StatItemProps[] = [
    {
      label: "New",
      value: stats?.new ?? 0,
      Icon: Sparkles,
      color: "bg-blue-500/10 text-blue-600",
    },
    {
      label: "Analyzed",
      value: stats?.analyzed ?? 0,
      Icon: Search,
      color: "bg-indigo-500/10 text-indigo-600",
    },
    {
      label: "Prepped",
      value: stats?.prepped ?? 0,
      Icon: FileText,
      color: "bg-cyan-500/10 text-cyan-600",
    },
    {
      label: "Reviewed",
      value: stats?.reviewed ?? 0,
      Icon: Eye,
      color: "bg-purple-500/10 text-purple-600",
    },
  ];

  const postAppliedStats: StatItemProps[] = [
    {
      label: "Applied",
      value: stats?.applied ?? 0,
      Icon: Send,
      color: "bg-green-500/10 text-green-600",
    },
    {
      label: "Interviewing",
      value: stats?.interviewing ?? 0,
      Icon: PhoneCall,
      color: "bg-amber-500/10 text-amber-600",
    },
    {
      label: "Rejected",
      value: stats?.rejected ?? 0,
      Icon: ThumbsDown,
      color: "bg-red-500/10 text-red-500",
    },
  ];

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="py-6">
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-52 rounded-xl" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardContent className="py-6">
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {summaryStats.map((item) => (
              <StatItem key={item.label} {...item} />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <StatSection title="Pre-Applied" items={preAppliedStats} />
            <StatSection title="Post-Applied" items={postAppliedStats} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
