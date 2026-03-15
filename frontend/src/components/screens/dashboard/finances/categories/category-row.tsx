"use client";

import { Button } from "@/components/ui";
import type { FinanceCategory } from "@/types";
import { Pencil, Trash2 } from "lucide-react";
import { ColorSwatch } from "./color-swatch";

interface CategoryRowProps {
  category: FinanceCategory;
  onEdit: (category: FinanceCategory) => void;
  onDelete: (id: string) => void;
}

export function CategoryRow({ category, onEdit, onDelete }: CategoryRowProps) {
  return (
    <div className="hover:bg-muted/40 flex items-center justify-between px-4 py-2.5 transition-colors">
      <div className="flex items-center gap-3">
        <ColorSwatch color={category.color} />
        <span className="text-sm font-medium">{category.name}</span>
        <span className="text-muted-foreground font-mono text-xs">{category.slug}</span>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onEdit(category)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive h-7 w-7 p-0"
          onClick={() => onDelete(category.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
