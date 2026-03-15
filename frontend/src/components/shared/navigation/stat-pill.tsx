"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const toneStyles = {
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  cyan: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  green: "bg-green-500/10 text-green-600 dark:text-green-400",
  purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  red: "bg-red-500/10 text-red-600 dark:text-red-400",
  slate: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
} as const;

interface StatPillProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  tone: keyof typeof toneStyles;
  highlight?: boolean;
}

export function StatPill({ icon: Icon, label, value, tone, highlight }: StatPillProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1 rounded-lg px-1 py-2 transition-colors",
        toneStyles[tone],
        highlight && "ring-1 ring-current/20"
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="text-sm leading-none font-bold">{value}</span>
      <span className="text-[10px] tracking-wider uppercase opacity-80">{label}</span>
    </div>
  );
}
