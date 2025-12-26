"use client";

import { Button, Card, CardContent, Badge } from "@/components/ui";
import { getFileIcon } from "@/lib/file-utils";
import type { ResumeSummary } from "@/types";
import { Trash2, Star, StarOff, AlertCircle, CheckCircle2 } from "lucide-react";

interface ResumeListItemProps {
  resume: ResumeSummary;
  onDelete: () => void;
  onSetPrimary: () => void;
  isLoading?: boolean;
}

export function ResumeListItem({
  resume,
  onDelete,
  onSetPrimary,
  isLoading,
}: ResumeListItemProps) {
  return (
    <Card className={resume.is_primary ? "border-primary/50 ring-1 ring-primary/20" : ""}>
      <CardContent className="flex items-center gap-4 py-4">
        {getFileIcon(resume.original_filename)}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium">{resume.name}</p>
            {resume.is_primary && (
              <Badge variant="default" className="shrink-0">
                <Star className="mr-1 h-3 w-3" />
                Primary
              </Badge>
            )}
          </div>
          <p className="truncate text-sm text-muted-foreground">
            {resume.original_filename}
          </p>
          <div className="mt-1 flex items-center gap-2 text-xs">
            {resume.has_text ? (
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="h-3 w-3" />
                Text extracted
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-600">
                <AlertCircle className="h-3 w-3" />
                No text extracted
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 gap-1">
          {!resume.is_primary && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSetPrimary}
              disabled={isLoading}
              title="Set as primary"
            >
              <StarOff className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            disabled={isLoading}
            className="hover:text-destructive"
            title="Delete resume"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

