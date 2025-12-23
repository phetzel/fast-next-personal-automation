"use client";

import { useState, useEffect } from "react";
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
import type { UserProfile, UserProfileCreate } from "@/types";
import { Loader2, Save, X, Plus } from "lucide-react";

interface ProfileFormProps {
  profile: UserProfile | null;
  isLoading?: boolean;
  onSave: (data: UserProfileCreate) => Promise<UserProfile | null>;
  className?: string;
}

export function ProfileForm({
  profile,
  isLoading,
  onSave,
  className,
}: ProfileFormProps) {
  const [resumeText, setResumeText] = useState(profile?.resume_text || "");
  const [targetRoles, setTargetRoles] = useState<string[]>(
    profile?.target_roles || []
  );
  const [targetLocations, setTargetLocations] = useState<string[]>(
    profile?.target_locations || []
  );
  const [minScore, setMinScore] = useState(profile?.min_score_threshold || 7.0);
  const [isSaving, setIsSaving] = useState(false);
  const [newRole, setNewRole] = useState("");
  const [newLocation, setNewLocation] = useState("");

  // Update form when profile changes
  useEffect(() => {
    if (profile) {
      setResumeText(profile.resume_text || "");
      setTargetRoles(profile.target_roles || []);
      setTargetLocations(profile.target_locations || []);
      setMinScore(profile.min_score_threshold);
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    await onSave({
      resume_text: resumeText || null,
      target_roles: targetRoles.length > 0 ? targetRoles : null,
      target_locations: targetLocations.length > 0 ? targetLocations : null,
      min_score_threshold: minScore,
    });

    setIsSaving(false);
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

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Job Search Profile</CardTitle>
        <CardDescription>
          Set up your resume and preferences for the AI job matching
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Resume */}
          <div>
            <label className="mb-2 block text-sm font-medium">
              Resume / CV Text
            </label>
            <Textarea
              value={resumeText}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setResumeText(e.target.value)}
              placeholder="Paste your resume text here... The AI will use this to score how well jobs match your skills and experience."
              rows={10}
              className="font-mono text-sm"
            />
            <p className="text-muted-foreground mt-1 text-xs">
              {resumeText.length} characters
            </p>
          </div>

          {/* Target Roles */}
          <div>
            <label className="mb-2 block text-sm font-medium">
              Target Roles
            </label>
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
            <label className="mb-2 block text-sm font-medium">
              Target Locations
            </label>
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

          {/* Submit */}
          <Button type="submit" disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Profile
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

