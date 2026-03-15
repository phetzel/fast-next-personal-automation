"use client";

import type { LucideIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui";
import { cn } from "@/lib/utils";

interface StatusAlertProps {
  icon: LucideIcon;
  title?: string;
  children: React.ReactNode;
  variant?: "default" | "destructive";
  className?: string;
}

export function StatusAlert({
  icon: Icon,
  title,
  children,
  variant = "default",
  className,
}: StatusAlertProps) {
  return (
    <Alert variant={variant} className={cn("flex items-start gap-3", className)}>
      <Icon className="mt-0.5 h-4 w-4" />
      <div>
        {title ? <AlertTitle>{title}</AlertTitle> : null}
        <AlertDescription>{children}</AlertDescription>
      </div>
    </Alert>
  );
}
