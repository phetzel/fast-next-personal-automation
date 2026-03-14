"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { FinanceCategory } from "@/types";
import type { LucideIcon } from "lucide-react";
import { CategoryRow } from "./category-row";

interface CategorySectionCardProps {
  title: string;
  icon: LucideIcon;
  iconClassName: string;
  emptyText: string;
  categories: FinanceCategory[];
  onEdit: (category: FinanceCategory) => void;
  onDelete: (id: string) => void;
}

export function CategorySectionCard({
  title,
  icon: Icon,
  iconClassName,
  emptyText,
  categories,
  onEdit,
  onDelete,
}: CategorySectionCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className={iconClassName} />
          {title}
          <span className="text-muted-foreground ml-auto text-sm font-normal">
            {categories.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {categories.length === 0 ? (
          <p className="text-muted-foreground px-4 pb-4 text-sm">{emptyText}</p>
        ) : (
          <div className="divide-y">
            {categories.map((category) => (
              <CategoryRow
                key={category.id}
                category={category}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
