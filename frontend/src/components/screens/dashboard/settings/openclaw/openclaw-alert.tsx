import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface OpenClawAlertProps {
  children: ReactNode;
  variant?: "default" | "destructive";
}

export function OpenClawAlert({ children, variant = "default" }: OpenClawAlertProps) {
  return (
    <div
      className={cn("flex items-start gap-3 rounded-lg border p-4", {
        "border-green-500/40 bg-green-50 text-green-700": variant === "default",
        "border-destructive/50 bg-destructive/10 text-destructive": variant === "destructive",
      })}
    >
      {children}
    </div>
  );
}
