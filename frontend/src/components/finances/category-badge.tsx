"use client";

import { cn } from "@/lib/utils";
import { CATEGORY_LABELS, INCOME_CATEGORIES } from "@/types";
import type { TransactionCategory } from "@/types";

interface CategoryBadgeProps {
  category: TransactionCategory | null | undefined;
  className?: string;
  size?: "sm" | "md";
}

const categoryColors: Partial<Record<TransactionCategory, string>> = {
  income_salary: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  income_freelance: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  income_investment: "bg-teal-500/10 text-teal-700 dark:text-teal-400",
  income_refund: "bg-teal-500/10 text-teal-700 dark:text-teal-400",
  income_other: "bg-green-500/10 text-green-700 dark:text-green-400",
  housing: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  utilities: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400",
  groceries: "bg-lime-500/10 text-lime-700 dark:text-lime-400",
  dining: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  transportation: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  healthcare: "bg-red-500/10 text-red-700 dark:text-red-400",
  entertainment: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  shopping: "bg-pink-500/10 text-pink-700 dark:text-pink-400",
  subscriptions: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
  travel: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  education: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400",
  personal_care: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
  fitness: "bg-green-500/10 text-green-700 dark:text-green-400",
  pets: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  gifts_donations: "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-400",
  business: "bg-slate-500/10 text-slate-700 dark:text-slate-400",
  taxes: "bg-zinc-500/10 text-zinc-700 dark:text-zinc-400",
  transfer: "bg-gray-500/10 text-gray-700 dark:text-gray-400",
  other: "bg-muted text-muted-foreground",
};

export function CategoryBadge({ category, className, size = "sm" }: CategoryBadgeProps) {
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

  const isIncome = INCOME_CATEGORIES.includes(category);
  const colorClass = categoryColors[category] ?? "bg-muted text-muted-foreground";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 font-medium",
        size === "sm" ? "text-[11px]" : "text-xs",
        colorClass,
        isIncome && "font-semibold",
        className
      )}
    >
      {isIncome && <span className="mr-1">+</span>}
      {CATEGORY_LABELS[category]}
    </span>
  );
}
