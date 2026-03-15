"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui";
import { cn } from "@/lib/utils";

const toneStyles = {
  amber: {
    icon: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400",
    gradient: "bg-gradient-to-br from-amber-500/5 via-transparent to-orange-500/5",
  },
  blue: {
    icon: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400",
    gradient: "bg-gradient-to-br from-blue-500/5 via-transparent to-indigo-500/5",
  },
  emerald: {
    icon: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400",
    gradient: "bg-gradient-to-br from-emerald-500/5 via-transparent to-teal-500/5",
  },
} as const;

interface AreaOverviewCardShellProps {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  tone: keyof typeof toneStyles;
  stats: ReactNode;
  footer?: ReactNode;
}

export function AreaOverviewCardShell({
  href,
  title,
  description,
  icon: Icon,
  tone,
  stats,
  footer,
}: AreaOverviewCardShellProps) {
  const toneStyle = toneStyles[tone];

  return (
    <Link href={href} className="group block">
      <Card
        className={cn(
          "relative overflow-hidden transition-all duration-300",
          "hover:ring-primary/20 hover:shadow-lg hover:ring-2",
          "hover:-translate-y-0.5"
        )}
      >
        <div
          className={cn(
            "absolute inset-0 opacity-0 transition-opacity duration-300",
            toneStyle.gradient,
            "group-hover:opacity-100"
          )}
        />

        <CardContent className="relative p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn("rounded-xl p-3 transition-colors", toneStyle.icon)}>
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
                <p className="text-muted-foreground text-sm">{description}</p>
              </div>
            </div>
            <ArrowRight
              className={cn(
                "text-muted-foreground h-5 w-5 transition-transform",
                "group-hover:text-primary group-hover:translate-x-1"
              )}
            />
          </div>

          {stats}

          {footer ? (
            <div className="border-border/50 mt-4 border-t pt-4 text-sm">{footer}</div>
          ) : null}
        </CardContent>
      </Card>
    </Link>
  );
}
