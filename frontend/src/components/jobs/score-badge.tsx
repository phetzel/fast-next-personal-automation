"use client";

import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils";
import { Star } from "lucide-react";

interface ScoreBadgeProps {
  score: number | null;
  className?: string;
  showIcon?: boolean;
}

function getScoreConfig(score: number | null): {
  label: string;
  className: string;
} {
  if (score === null) {
    return {
      label: "N/A",
      className: "bg-gray-500/10 text-gray-500 border-gray-500/20",
    };
  }

  if (score >= 8) {
    return {
      label: score.toFixed(1),
      className: "bg-green-500/10 text-green-600 border-green-500/20",
    };
  }

  if (score >= 6) {
    return {
      label: score.toFixed(1),
      className: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    };
  }

  if (score >= 4) {
    return {
      label: score.toFixed(1),
      className: "bg-orange-500/10 text-orange-600 border-orange-500/20",
    };
  }

  return {
    label: score.toFixed(1),
    className: "bg-red-500/10 text-red-600 border-red-500/20",
  };
}

export function ScoreBadge({ score, className, showIcon = true }: ScoreBadgeProps) {
  const config = getScoreConfig(score);

  return (
    <Badge
      variant="outline"
      className={cn("gap-1 font-mono font-medium", config.className, className)}
    >
      {showIcon && <Star className="h-3 w-3" />}
      {config.label}
    </Badge>
  );
}

