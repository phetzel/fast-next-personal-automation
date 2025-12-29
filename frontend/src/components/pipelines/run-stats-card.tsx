"use client";

import { Card, CardContent } from "@/components/ui";
import type { PipelineRunStats } from "@/types";
import { Activity, CheckCircle, XCircle, Clock } from "lucide-react";

interface RunStatsCardProps {
  stats: PipelineRunStats | null;
  isLoading?: boolean;
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export function RunStatsCard({ stats, isLoading }: RunStatsCardProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="bg-muted h-4 w-20 rounded" />
              <div className="bg-muted mt-2 h-8 w-16 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const statItems = [
    {
      label: "Total Runs",
      value: stats.total,
      icon: Activity,
      color: "text-blue-600",
      bgColor: "bg-blue-500/10",
    },
    {
      label: "Successful",
      value: stats.success,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-500/10",
    },
    {
      label: "Failed",
      value: stats.errors,
      icon: XCircle,
      color: "text-red-600",
      bgColor: "bg-red-500/10",
    },
    {
      label: "Avg Duration",
      value: formatDuration(stats.avg_duration_ms),
      icon: Clock,
      color: "text-orange-600",
      bgColor: "bg-orange-500/10",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {statItems.map((item) => (
        <Card key={item.label}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`rounded-lg p-2 ${item.bgColor}`}>
                <item.icon className={`h-5 w-5 ${item.color}`} />
              </div>
              <div>
                <p className="text-muted-foreground text-sm font-medium">
                  {item.label}
                </p>
                <p className="text-2xl font-bold">{item.value}</p>
              </div>
            </div>
            {item.label === "Successful" && stats.total > 0 && (
              <div className="mt-2">
                <div className="bg-muted h-2 overflow-hidden rounded-full">
                  <div
                    className="h-full bg-green-500 transition-all duration-500"
                    style={{ width: `${stats.success_rate}%` }}
                  />
                </div>
                <p className="text-muted-foreground mt-1 text-xs">
                  {stats.success_rate.toFixed(1)}% success rate
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}



