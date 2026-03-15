"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui";

interface PaginationControlsProps {
  page: number;
  totalPages: number;
  summary: string;
  onPrevious: () => void;
  onNext: () => void;
}

export function PaginationControls({
  page,
  totalPages,
  summary,
  onPrevious,
  onNext,
}: PaginationControlsProps) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="mt-6 flex items-center justify-between border-t pt-4">
      <p className="text-muted-foreground text-sm">{summary}</p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onPrevious} disabled={page <= 1}>
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        <Button variant="outline" size="sm" onClick={onNext} disabled={page >= totalPages}>
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
