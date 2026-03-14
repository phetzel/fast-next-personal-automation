"use client";

import { useState } from "react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Textarea,
} from "@/components/ui";
import type { Story } from "@/types";
import { Loader2, Save } from "lucide-react";

export interface StoryFormData {
  name: string;
  content: string;
  is_primary: boolean;
}

interface StoryFormProps {
  story?: Story | null;
  onSave: (data: StoryFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function StoryForm({ story, onSave, onCancel, isLoading }: StoryFormProps) {
  const [name, setName] = useState(story?.name || "");
  const [content, setContent] = useState(story?.content || "");
  const isPrimary = story?.is_primary || false;

  const isEditing = !!story;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({ name, content, is_primary: isPrimary });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? "Edit Story" : "Create New Story"}</CardTitle>
        <CardDescription>
          {isEditing
            ? "Update your personal story or narrative"
            : "Write a story about yourself - things you want to emphasize during job applications"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Story Name */}
          <div>
            <label className="mb-2 block text-sm font-medium">Story Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., My Career Journey"
              required
              maxLength={100}
            />
            <p className="text-muted-foreground mt-1 text-xs">Give this story a memorable name</p>
          </div>

          {/* Story Content */}
          <div>
            <label className="mb-2 block text-sm font-medium">Your Story</label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write about yourself... What makes you unique? What are you passionate about? What do you want employers to know?"
              required
              className="min-h-[300px]"
            />
            <p className="text-muted-foreground mt-1 text-xs">
              Markdown is supported. This content will be used to help personalize job applications.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button type="submit" disabled={isLoading || !name.trim() || !content.trim()}>
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {isEditing ? "Save Changes" : "Create Story"}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
