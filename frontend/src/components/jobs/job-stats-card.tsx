"use client";

import { Card, CardContent } from "@/components/ui";
import type { JobStats } from "@/types";
import { cn } from "@/lib/utils";
import {
  Briefcase,
  Sparkles,
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

export function JobStatsCard({ stats, isLoading, className }: JobStatsCardProps) {
  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="py-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-200" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardContent className="py-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9">
          <StatItem
            label="Total"
            value={stats?.total ?? 0}
            Icon={Briefcase}
            color="bg-primary/10 text-primary"
          />
          <StatItem
            label="New"
            value={stats?.new ?? 0}
            Icon={Sparkles}
            color="bg-blue-500/10 text-blue-600"
          />
          <StatItem
            label="Prepped"
            value={stats?.prepped ?? 0}
            Icon={FileText}
            color="bg-cyan-500/10 text-cyan-600"
          />
          <StatItem
            label="Reviewed"
            value={stats?.reviewed ?? 0}
            Icon={Eye}
            color="bg-purple-500/10 text-purple-600"
          />
          <StatItem
            label="Applied"
            value={stats?.applied ?? 0}
            Icon={Send}
            color="bg-green-500/10 text-green-600"
          />
          <StatItem
            label="Interviewing"
            value={stats?.interviewing ?? 0}
            Icon={PhoneCall}
            color="bg-amber-500/10 text-amber-600"
          />
          <StatItem
            label="Rejected"
            value={stats?.rejected ?? 0}
            Icon={ThumbsDown}
            color="bg-red-500/10 text-red-500"
          />
          <StatItem
            label="High Score"
            value={stats?.high_scoring ?? 0}
            Icon={TrendingUp}
            color="bg-emerald-500/10 text-emerald-600"
          />
          <StatItem
            label="Avg Score"
            value={stats?.avg_score?.toFixed(1) ?? "-"}
            Icon={Star}
            color="bg-yellow-500/10 text-yellow-600"
          />
        </div>
      </CardContent>
    </Card>
  );
}
