"use client";

import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ScrollArea,
} from "@/components/ui";
import { cn } from "@/lib/utils";

interface FormDialogShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: string;
  scrollable?: boolean;
  className?: string;
  contentClassName?: string;
}

export function FormDialogShell({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  maxWidth = "sm:max-w-lg",
  scrollable = false,
  className,
  contentClassName,
}: FormDialogShellProps) {
  const content = scrollable ? (
    <ScrollArea className={cn("max-h-[70vh] pr-4", contentClassName)}>{children}</ScrollArea>
  ) : (
    <div className={contentClassName}>{children}</div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(maxWidth, className)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {content}
        {footer ? <DialogFooter>{footer}</DialogFooter> : null}
      </DialogContent>
    </Dialog>
  );
}
