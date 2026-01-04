"use client";

import { Mail, Search, PenLine, type LucideIcon } from "lucide-react";
import type { IngestionSource } from "@/types";
import { cn } from "@/lib/utils";

/**
 * Configuration for displaying ingestion source indicators.
 */
export const INGESTION_SOURCE_CONFIG: Record<
  IngestionSource,
  {
    icon: LucideIcon;
    color: string;
    label: string;
  }
> = {
  scrape: {
    icon: Search,
    color: "text-blue-600 dark:text-blue-400",
    label: "Scraped",
  },
  email: {
    icon: Mail,
    color: "text-amber-600 dark:text-amber-400",
    label: "Email",
  },
  manual: {
    icon: PenLine,
    color: "text-purple-600 dark:text-purple-400",
    label: "Manual",
  },
};

interface IngestionSourceBadgeProps {
  source: IngestionSource | null;
  showLabel?: boolean;
  className?: string;
}

/**
 * Badge component for displaying job ingestion source.
 */
export function IngestionSourceBadge({
  source,
  showLabel = false,
  className,
}: IngestionSourceBadgeProps) {
  if (!source) return null;

  const config = INGESTION_SOURCE_CONFIG[source];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1",
        showLabel ? "text-[10px] font-medium" : "text-xs",
        config.color,
        className
      )}
      title={`Added via ${config.label}`}
    >
      <Icon className="h-3 w-3" />
      {showLabel && config.label}
    </span>
  );
}

