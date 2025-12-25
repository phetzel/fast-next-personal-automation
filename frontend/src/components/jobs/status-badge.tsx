"use client";

import { Badge } from "@/components/ui";
import type { JobStatus } from "@/types";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  Eye,
  Send,
  ThumbsDown,
  PhoneCall,
  FileText,
} from "lucide-react";

interface StatusBadgeProps {
  status: JobStatus;
  className?: string;
}

const statusConfig: Record<
  JobStatus,
  { label: string; className: string; Icon: typeof Sparkles }
> = {
  new: {
    label: "New",
    className: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    Icon: Sparkles,
  },
  prepped: {
    label: "Prepped",
    className: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
    Icon: FileText,
  },
  reviewed: {
    label: "Reviewed",
    className: "bg-purple-500/10 text-purple-600 border-purple-500/20",
    Icon: Eye,
  },
  applied: {
    label: "Applied",
    className: "bg-green-500/10 text-green-600 border-green-500/20",
    Icon: Send,
  },
  rejected: {
    label: "Rejected",
    className: "bg-gray-500/10 text-gray-500 border-gray-500/20",
    Icon: ThumbsDown,
  },
  interviewing: {
    label: "Interviewing",
    className: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    Icon: PhoneCall,
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  const { Icon } = config;

  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 font-medium", config.className, className)}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

