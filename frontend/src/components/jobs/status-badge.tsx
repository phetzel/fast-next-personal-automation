"use client";

import { Badge } from "@/components/ui";
import type { JobStatus } from "@/types";
import { JOB_STATUS_CONFIG } from "@/types";
import { cn } from "@/lib/utils";
import { Sparkles, Eye, Send, ThumbsDown, PhoneCall, FileText } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface StatusBadgeProps {
  status: JobStatus;
  className?: string;
}

const statusStyles: Record<JobStatus, { className: string; Icon: LucideIcon }> = {
  new: {
    className: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    Icon: Sparkles,
  },
  prepped: {
    className: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
    Icon: FileText,
  },
  reviewed: {
    className: "bg-purple-500/10 text-purple-600 border-purple-500/20",
    Icon: Eye,
  },
  applied: {
    className: "bg-green-500/10 text-green-600 border-green-500/20",
    Icon: Send,
  },
  interviewing: {
    className: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    Icon: PhoneCall,
  },
  rejected: {
    className: "bg-red-500/10 text-red-500 border-red-500/20",
    Icon: ThumbsDown,
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const style = statusStyles[status];
  const config = JOB_STATUS_CONFIG[status];
  const { Icon } = style;

  return (
    <Badge variant="outline" className={cn("gap-1.5 font-medium", style.className, className)}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}
