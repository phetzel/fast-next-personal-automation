"use client";

import { Badge } from "@/components/ui";
import type { PipelineRunStatus } from "@/types";
import { cn } from "@/lib/utils";
import {
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Ban,
} from "lucide-react";

interface RunStatusBadgeProps {
  status: PipelineRunStatus;
  className?: string;
}

const statusConfig: Record<
  PipelineRunStatus,
  { label: string; className: string; Icon: typeof CheckCircle }
> = {
  pending: {
    label: "Pending",
    className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    Icon: Clock,
  },
  running: {
    label: "Running",
    className: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    Icon: Loader2,
  },
  success: {
    label: "Success",
    className: "bg-green-500/10 text-green-600 border-green-500/20",
    Icon: CheckCircle,
  },
  error: {
    label: "Error",
    className: "bg-red-500/10 text-red-600 border-red-500/20",
    Icon: XCircle,
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-gray-500/10 text-gray-600 border-gray-500/20",
    Icon: Ban,
  },
};

export function RunStatusBadge({ status, className }: RunStatusBadgeProps) {
  const config = statusConfig[status];
  const { Icon } = config;

  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 font-medium", config.className, className)}
    >
      <Icon
        className={cn("h-3 w-3", status === "running" && "animate-spin")}
      />
      {config.label}
    </Badge>
  );
}



