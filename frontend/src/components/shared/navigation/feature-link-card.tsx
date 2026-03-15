"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui";
import { cn } from "@/lib/utils";

const toneStyles = {
  blue: "bg-blue-500/10 text-blue-600",
  cyan: "bg-cyan-500/10 text-cyan-600",
  emerald: "bg-emerald-500/10 text-emerald-600",
  green: "bg-green-500/10 text-green-600",
  orange: "bg-orange-500/10 text-orange-600",
  purple: "bg-purple-500/10 text-purple-600",
  violet: "bg-violet-500/10 text-violet-600",
  amber: "bg-amber-500/10 text-amber-600",
} as const;

interface FeatureLinkCardProps {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  tone: keyof typeof toneStyles;
}

export function FeatureLinkCard({
  href,
  icon: Icon,
  title,
  description,
  tone,
}: FeatureLinkCardProps) {
  return (
    <Link href={href} className="block">
      <Card className="hover:ring-primary/20 h-full transition-all hover:shadow-md hover:ring-2">
        <CardContent className="flex items-center gap-4 p-5">
          <div className={cn("rounded-lg p-2.5", toneStyles[tone])}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold">{title}</h3>
            <p className="text-muted-foreground truncate text-sm">{description}</p>
          </div>
          <ArrowRight className="text-muted-foreground h-4 w-4 shrink-0" />
        </CardContent>
      </Card>
    </Link>
  );
}
