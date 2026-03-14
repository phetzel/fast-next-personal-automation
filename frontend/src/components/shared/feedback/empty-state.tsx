"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("py-12 text-center", className)}>
      <Icon className="text-muted-foreground/50 mx-auto mb-4 h-12 w-12" />
      <p className="font-medium">{title}</p>
      <p className="text-muted-foreground mt-1 text-sm">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
