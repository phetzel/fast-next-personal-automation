"use client";

import { useState, useEffect } from "react";
import { useStories } from "@/hooks";
import { Button, Card, CardContent } from "@/components/ui";
import { StoryForm, type StoryFormData } from "./story-form";
import { StoryListItem } from "./story-list-item";
import type { Story, StoryCreate, StoryUpdate } from "@/types";
import { Loader2, Plus, BookOpen } from "lucide-react";

export function StoryTab() {
  const {
    stories,
    isLoading,
    error,
    fetchStories,
    getStory,
    createStory,
    updateStory,
    deleteStory,
    setPrimary,
  } = useStories();

  const [view, setView] = useState<"list" | "create" | "edit">("list");
  const [editingStory, setEditingStory] = useState<Story | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchStories();
  }, [fetchStories]);

  const handleCreate = async (data: StoryFormData) => {
    setIsSubmitting(true);
    const result = await createStory(data as StoryCreate);
    setIsSubmitting(false);
    if (result) {
      setView("list");
    }
  };

  const handleUpdate = async (data: StoryFormData) => {
    if (!editingStory) return;
    setIsSubmitting(true);
    const result = await updateStory(editingStory.id, data as StoryUpdate);
    setIsSubmitting(false);
    if (result) {
      setEditingStory(null);
      setView("list");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this story?")) return;
    await deleteStory(id);
  };

  const handleSetPrimary = async (id: string) => {
    await setPrimary(id);
  };

  const handleEdit = async (storySummary: { id: string }) => {
    const fullStory = await getStory(storySummary.id);
    if (fullStory) {
      setEditingStory(fullStory);
      setView("edit");
    }
  };

  const handleCancel = () => {
    setEditingStory(null);
    setView("list");
  };

  if (isLoading && stories.length === 0) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (view === "create" || view === "edit") {
    return (
      <StoryForm
        story={editingStory}
        onSave={view === "create" ? handleCreate : handleUpdate}
        onCancel={handleCancel}
        isLoading={isSubmitting}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with create button */}
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          Write personal narratives to emphasize during job applications
        </p>
        <Button onClick={() => setView("create")} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          New Story
        </Button>
      </div>

      {error && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="py-4">
            <p className="text-destructive text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {stories.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 rounded-full bg-purple-500/10 p-4">
              <BookOpen className="h-10 w-10 text-purple-600" />
            </div>
            <h2 className="mb-2 text-xl font-semibold">No Stories Yet</h2>
            <p className="text-muted-foreground mb-4 max-w-md">
              Write your first story to share what makes you unique. This helps personalize your job
              applications.
            </p>
            <Button onClick={() => setView("create")}>
              <Plus className="mr-2 h-4 w-4" />
              Write Your First Story
            </Button>
          </CardContent>
        </Card>
      )}

      {stories.length > 0 && (
        <div className="space-y-2">
          {stories.map((story) => (
            <StoryListItem
              key={story.id}
              story={story}
              onEdit={() => handleEdit(story)}
              onDelete={() => handleDelete(story.id)}
              onSetPrimary={() => handleSetPrimary(story.id)}
              isLoading={isLoading}
            />
          ))}
        </div>
      )}
    </div>
  );
}
