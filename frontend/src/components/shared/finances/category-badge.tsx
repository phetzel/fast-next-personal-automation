"use client";

import { useCategoriesQuery } from "@/hooks/queries/finances";
import { cn } from "@/lib/utils";

interface CategoryBadgeProps {
  category: string | null | undefined;
  className?: string;
  size?: "sm" | "md";
}

function hexToRgb(hex: string): string | null {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return null;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  return `${r}, ${g}, ${b}`;
}

export function CategoryBadge({ category, className, size = "sm" }: CategoryBadgeProps) {
  const categories = useCategoriesQuery(false).data ?? [];

  if (!category) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full border border-dashed px-2 py-0.5",
          "text-muted-foreground border-muted-foreground/30",
          size === "sm" ? "text-[11px]" : "text-xs",
          className
        )}
      >
        Uncategorized
      </span>
    );
  }

  const cat = categories.find((c) => c.slug === category);
  const name = cat?.name ?? category;
  const isIncome = cat?.category_type === "income";
  const rgb = cat?.color ? hexToRgb(cat.color) : null;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 font-medium",
        size === "sm" ? "text-[11px]" : "text-xs",
        !rgb && "bg-muted text-muted-foreground",
        isIncome && "font-semibold",
        className
      )}
      style={
        rgb
          ? {
              backgroundColor: `rgba(${rgb}, 0.12)`,
              color: cat?.color ?? undefined,
            }
          : undefined
      }
    >
      {isIncome && <span className="mr-1">+</span>}
      {name}
    </span>
  );
}
