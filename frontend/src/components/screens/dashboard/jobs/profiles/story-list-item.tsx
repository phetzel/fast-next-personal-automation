"use client";

import { Button, Card, CardContent, Badge } from "@/components/ui";
import type { StorySummary } from "@/types";
import { Pencil, Trash2, Star, StarOff, BookOpen } from "lucide-react";

interface StoryListItemProps {
  story: StorySummary;
  onEdit: () => void;
  onDelete: () => void;
  onSetPrimary: () => void;
  isLoading?: boolean;
}

export function StoryListItem({
  story,
  onEdit,
  onDelete,
  onSetPrimary,
  isLoading,
}: StoryListItemProps) {
  return (
    <Card className={story.is_primary ? "border-primary/50 ring-primary/20 ring-1" : ""}>
      <CardContent className="flex items-start gap-4 py-4">
        <BookOpen className="mt-1 h-5 w-5 text-purple-500" />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium">{story.name}</p>
            {story.is_primary && (
              <Badge variant="default" className="shrink-0">
                <Star className="mr-1 h-3 w-3" />
                Primary
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">{story.content_preview}</p>
        </div>

        <div className="flex shrink-0 gap-1">
          {!story.is_primary && (
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
          <Button variant="ghost" size="sm" onClick={onEdit} disabled={isLoading}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            disabled={isLoading}
            className="hover:text-destructive"
            title="Delete story"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
