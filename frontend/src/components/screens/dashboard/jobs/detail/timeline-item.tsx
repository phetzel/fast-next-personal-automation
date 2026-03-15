"use client";

import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface TimelineItemProps {
  label: string;
  date: string;
  isCompleted?: boolean;
  isRejected?: boolean;
}

export function TimelineItem({ label, date, isCompleted, isRejected }: TimelineItemProps) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "h-2 w-2 rounded-full",
          isRejected ? "bg-red-500" : isCompleted ? "bg-green-500" : "bg-muted-foreground/30"
        )}
      />
      <div className="flex flex-1 items-center justify-between">
        <span className="text-sm">{label}</span>
        <span className="text-muted-foreground text-xs">
          {format(new Date(date), "MMM d, h:mm a")}
        </span>
      </div>
    </div>
  );
}
