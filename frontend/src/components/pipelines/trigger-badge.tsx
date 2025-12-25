"use client";

import { Badge } from "@/components/ui";
import type { PipelineTriggerType } from "@/types";
import { cn } from "@/lib/utils";
import {
  Globe,
  Webhook,
  Bot,
  Timer,
  Hand,
} from "lucide-react";

interface TriggerBadgeProps {
  trigger: PipelineTriggerType;
  className?: string;
}

const triggerConfig: Record<
  PipelineTriggerType,
  { label: string; className: string; Icon: typeof Globe }
> = {
  api: {
    label: "API",
    className: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
    Icon: Globe,
  },
  webhook: {
    label: "Webhook",
    className: "bg-purple-500/10 text-purple-600 border-purple-500/20",
    Icon: Webhook,
  },
  agent: {
    label: "Agent",
    className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    Icon: Bot,
  },
  cron: {
    label: "Scheduled",
    className: "bg-orange-500/10 text-orange-600 border-orange-500/20",
    Icon: Timer,
  },
  manual: {
    label: "Manual",
    className: "bg-slate-500/10 text-slate-600 border-slate-500/20",
    Icon: Hand,
  },
};

export function TriggerBadge({ trigger, className }: TriggerBadgeProps) {
  const config = triggerConfig[trigger];
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



