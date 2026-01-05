"use client";

import { Button, Card, CardContent } from "@/components/ui";
import type { ProjectSummary } from "@/types";
import { Trash2, FolderOpen, AlertCircle, CheckCircle2 } from "lucide-react";

interface ProjectListItemProps {
  project: ProjectSummary;
  onDelete: () => void;
  isLoading?: boolean;
}

export function ProjectListItem({ project, onDelete, isLoading }: ProjectListItemProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-4">
        <FolderOpen className="h-5 w-5 text-blue-500" />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium">{project.name}</p>
          </div>
          <p className="text-muted-foreground truncate text-sm">{project.original_filename}</p>
          <div className="mt-1 flex items-center gap-2 text-xs">
            {project.has_text ? (
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="h-3 w-3" />
                Content loaded
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-600">
                <AlertCircle className="h-3 w-3" />
                No content
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            disabled={isLoading}
            className="hover:text-destructive"
            title="Delete project"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
