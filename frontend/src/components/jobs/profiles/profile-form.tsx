"use client";

import React, { useState, useEffect } from "react";
import { useStories, useProjects } from "@/hooks";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from "@/components/ui";
import { ResumeSelector } from "@/components/jobs";
import type { JobProfile } from "@/types";
import { Loader2, Plus, X, Save, CheckCircle2 } from "lucide-react";

export interface ProfileFormData {
  name: string;
  resume_id: string | null;
  story_id: string | null;
  project_ids: string[] | null;
  target_roles: string[] | null;
  target_locations: string[] | null;
  min_score_threshold: number;
}

interface ProfileFormProps {
  profile?: JobProfile | null;
  onSave: (data: ProfileFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ProfileForm({
  profile,
  onSave,
  onCancel,
  isLoading,
}: ProfileFormProps) {
  const [name, setName] = useState(profile?.name || "");
  const [resumeId, setResumeId] = useState<string | null>(profile?.resume_id || null);
  const [storyId, setStoryId] = useState<string | null>(profile?.story_id || null);
  const [projectIds, setProjectIds] = useState<string[]>(profile?.project_ids || []);
  const [targetRoles, setTargetRoles] = useState<string[]>(profile?.target_roles || []);
  const [targetLocations, setTargetLocations] = useState<string[]>(
    profile?.target_locations || []
  );
  const [minScore, setMinScore] = useState(profile?.min_score_threshold || 7.0);
  const [newRole, setNewRole] = useState("");
  const [newLocation, setNewLocation] = useState("");

  // Fetch stories and projects for selectors
  const { stories, fetchStories } = useStories();
  const { projects, fetchProjects } = useProjects();

  useEffect(() => {
    fetchStories();
    fetchProjects();
  }, [fetchStories, fetchProjects]);

  const isEditing = !!profile;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const data: ProfileFormData = {
      name,
      resume_id: resumeId,
      story_id: storyId,
      project_ids: projectIds.length > 0 ? projectIds : null,
      target_roles: targetRoles.length > 0 ? targetRoles : null,
      target_locations: targetLocations.length > 0 ? targetLocations : null,
      min_score_threshold: minScore,
    };

    await onSave(data);
  };

  const addRole = () => {
    if (newRole.trim() && !targetRoles.includes(newRole.trim())) {
      setTargetRoles([...targetRoles, newRole.trim()]);
      setNewRole("");
    }
  };

  const removeRole = (role: string) => {
    setTargetRoles(targetRoles.filter((r) => r !== role));
  };

  const addLocation = () => {
    if (newLocation.trim() && !targetLocations.includes(newLocation.trim())) {
      setTargetLocations([...targetLocations, newLocation.trim()]);
      setNewLocation("");
    }
  };

  const removeLocation = (location: string) => {
    setTargetLocations(targetLocations.filter((l) => l !== location));
  };

  const toggleProject = (projectId: string) => {
    if (projectIds.includes(projectId)) {
      setProjectIds(projectIds.filter((id) => id !== projectId));
    } else {
      setProjectIds([...projectIds, projectId]);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? "Edit Profile" : "Create New Profile"}</CardTitle>
        <CardDescription>
          {isEditing
            ? "Update your job search profile settings"
            : "Create a new job search profile with your resume, story, projects, and preferences"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Profile Name */}
          <div>
            <label className="mb-2 block text-sm font-medium">Profile Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Backend Engineer Profile"
              required
              maxLength={100}
            />
            <p className="text-muted-foreground mt-1 text-xs">
              Give this profile a memorable name
            </p>
          </div>

          {/* Resume Selector */}
          <div>
            <label className="mb-2 block text-sm font-medium">Resume</label>
            <ResumeSelector
              value={resumeId}
              onChange={setResumeId}
              placeholder="Select a resume for this profile..."
            />
            <p className="text-muted-foreground mt-1 text-xs">
              Link a resume to this profile for AI job matching.
            </p>
          </div>

          {/* Story Selector */}
          <div>
            <label className="mb-2 block text-sm font-medium">Story</label>
            <select
              value={storyId || ""}
              onChange={(e) => setStoryId(e.target.value || null)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">No story selected</option>
              {stories.map((story) => (
                <option key={story.id} value={story.id}>
                  {story.name} {story.is_primary && "(Primary)"}
                </option>
              ))}
            </select>
            <p className="text-muted-foreground mt-1 text-xs">
              Link a story to personalize your job applications.
            </p>
          </div>

          {/* Projects Selector */}
          <div>
            <label className="mb-2 block text-sm font-medium">Projects</label>
            {projects.length > 0 ? (
              <div className="space-y-2 rounded-md border p-3">
                {projects.map((project) => (
                  <label
                    key={project.id}
                    className="flex cursor-pointer items-center gap-3 rounded p-2 hover:bg-muted/50"
                  >
                    <input
                      type="checkbox"
                      checked={projectIds.includes(project.id)}
                      onChange={() => toggleProject(project.id)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <div className="flex-1">
                      <span className="font-medium">{project.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {project.original_filename}
                      </span>
                    </div>
                    {project.has_text && (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    )}
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                No projects yet. Upload projects in the Projects tab.
              </p>
            )}
            <p className="text-muted-foreground mt-1 text-xs">
              Select projects to include in job applications for this profile.
            </p>
          </div>

          {/* Target Roles */}
          <div>
            <label className="mb-2 block text-sm font-medium">Target Roles</label>
            <div className="mb-2 flex flex-wrap gap-2">
              {targetRoles.map((role) => (
                <span
                  key={role}
                  className="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm"
                >
                  {role}
                  <button
                    type="button"
                    onClick={() => removeRole(role)}
                    className="hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                placeholder="e.g., Backend Engineer"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addRole();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={addRole}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Target Locations */}
          <div>
            <label className="mb-2 block text-sm font-medium">Target Locations</label>
            <div className="mb-2 flex flex-wrap gap-2">
              {targetLocations.map((location) => (
                <span
                  key={location}
                  className="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm"
                >
                  {location}
                  <button
                    type="button"
                    onClick={() => removeLocation(location)}
                    className="hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                placeholder="e.g., Remote or San Francisco, CA"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addLocation();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={addLocation}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Min Score */}
          <div>
            <label className="mb-2 block text-sm font-medium">
              Minimum Score Threshold
            </label>
            <div className="flex items-center gap-4">
              <Input
                type="number"
                value={minScore}
                onChange={(e) => setMinScore(parseFloat(e.target.value) || 7.0)}
                min={0}
                max={10}
                step={0.5}
                className="w-24"
              />
              <span className="text-muted-foreground text-sm">
                Jobs scoring below {minScore} won&apos;t be saved automatically
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button type="submit" disabled={isLoading || !name.trim()}>
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {isEditing ? "Save Changes" : "Create Profile"}
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

