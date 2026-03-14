"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";

function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function Tooltip({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function TooltipTrigger({
  children,
  asChild,
  ...props
}: React.HTMLAttributes<HTMLElement> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";
  return <Comp {...props}>{children}</Comp>;
}

function TooltipContent({ children, className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={className} {...props}>
      {children}
    </span>
  );
}

export { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent };
