"use client";

import type { LucideIcon } from "lucide-react";
import { Card, CardContent, Skeleton } from "@/components/ui";
import { cn } from "@/lib/utils";

const toneStyles = {
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  green: "bg-green-500/10 text-green-600 dark:text-green-400",
  red: "bg-red-500/10 text-red-600 dark:text-red-400",
  slate: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
  cyan: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
} as const;

interface MetricCardProps {
  title: string;
  value: string | number | null;
  icon: LucideIcon;
  tone: keyof typeof toneStyles;
  subtitle?: string;
}

export function MetricCard({ title, value, icon: Icon, tone, subtitle }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-3">
          <div className={cn("rounded-lg p-2.5", toneStyles[tone])}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-muted-foreground text-sm">{title}</p>
            {value === null ? (
              <Skeleton className="mt-1 h-6 w-20" />
            ) : (
              <p className="text-xl font-bold">{value}</p>
            )}
            {subtitle ? <p className="text-muted-foreground text-xs">{subtitle}</p> : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
