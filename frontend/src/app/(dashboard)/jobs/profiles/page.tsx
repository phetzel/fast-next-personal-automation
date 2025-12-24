"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useJobProfiles } from "@/hooks";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Badge,
} from "@/components/ui";
import { ResumeSelector } from "@/components/jobs";
import { ROUTES } from "@/lib/constants";
import type { JobProfile, JobProfileCreate, JobProfileUpdate } from "@/types";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Star,
  StarOff,
  X,
  Save,
  FileText,
  MapPin,
  Briefcase,
  ExternalLink,
} from "lucide-react";

/**
 * Profile form component for creating/editing profiles.
 */
function ProfileForm({
  profile,
  onSave,
  onCancel,
  isLoading,
}: {
  profile?: JobProfile | null;
  onSave: (data: JobProfileCreate | JobProfileUpdate) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}) {
  const [name, setName] = useState(profile?.name || "");
  const [resumeId, setResumeId] = useState<string | null>(profile?.resume_id || null);
  const [targetRoles, setTargetRoles] = useState<string[]>(profile?.target_roles || []);
  const [targetLocations, setTargetLocations] = useState<string[]>(
    profile?.target_locations || []
  );
  const [minScore, setMinScore] = useState(profile?.min_score_threshold || 7.0);
  const [newRole, setNewRole] = useState("");
  const [newLocation, setNewLocation] = useState("");

  const isEditing = !!profile;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const data: JobProfileCreate | JobProfileUpdate = {
      name,
      resume_id: resumeId,
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? "Edit Profile" : "Create New Profile"}</CardTitle>
        <CardDescription>
          {isEditing
            ? "Update your job search profile settings"
            : "Create a new job search profile with your resume and preferences"}
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
              Link a resume to this profile for AI job matching.{" "}
              <Link
                href={ROUTES.JOBS_RESUMES || "/jobs/resumes"}
                className="text-primary hover:underline"
              >
                Upload a new resume <ExternalLink className="inline h-3 w-3" />
              </Link>
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

/**
 * Profile card component for displaying a profile in the list.
 */
function ProfileCard({
  profile,
  onEdit,
  onDelete,
  onSetDefault,
  isLoading,
}: {
  profile: JobProfile;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
  isLoading?: boolean;
}) {
  return (
    <Card className={profile.is_default ? "border-primary/50 ring-1 ring-primary/20" : ""}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-lg font-semibold">{profile.name}</h3>
              {profile.is_default && (
                <Badge variant="default" className="shrink-0">
                  <Star className="mr-1 h-3 w-3" />
                  Default
                </Badge>
              )}
            </div>

            <div className="mt-3 space-y-2">
              {/* Resume status */}
              <div className="flex items-center gap-2 text-sm">
                <FileText className="text-muted-foreground h-4 w-4" />
                {profile.resume ? (
                  <span className="text-green-600">
                    {profile.resume.name}
                    {!profile.resume.has_text && (
                      <span className="ml-1 text-amber-600">(no text)</span>
                    )}
                  </span>
                ) : (
                  <span className="text-muted-foreground">No resume linked</span>
                )}
              </div>

              {/* Target roles */}
              {profile.target_roles && profile.target_roles.length > 0 && (
                <div className="flex items-start gap-2 text-sm">
                  <Briefcase className="text-muted-foreground mt-0.5 h-4 w-4" />
                  <div className="flex flex-wrap gap-1">
                    {profile.target_roles.slice(0, 3).map((role) => (
                      <Badge key={role} variant="secondary" className="text-xs">
                        {role}
                      </Badge>
                    ))}
                    {profile.target_roles.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{profile.target_roles.length - 3} more
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Target locations */}
              {profile.target_locations && profile.target_locations.length > 0 && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="text-muted-foreground mt-0.5 h-4 w-4" />
                  <div className="flex flex-wrap gap-1">
                    {profile.target_locations.slice(0, 3).map((loc) => (
                      <Badge key={loc} variant="outline" className="text-xs">
                        {loc}
                      </Badge>
                    ))}
                    {profile.target_locations.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{profile.target_locations.length - 3} more
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Score threshold */}
              <div className="text-muted-foreground text-xs">
                Min score: {profile.min_score_threshold}/10
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 gap-1">
            {!profile.is_default && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onSetDefault}
                disabled={isLoading}
                title="Set as default"
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
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Job Profiles page.
 */
export default function JobProfilesPage() {
  const {
    profiles,
    isLoading,
    error,
    fetchProfiles,
    getProfile,
    createProfile,
    updateProfile,
    deleteProfile,
    setDefault,
  } = useJobProfiles();

  const [view, setView] = useState<"list" | "create" | "edit">("list");
  const [editingProfile, setEditingProfile] = useState<JobProfile | null>(null);
  const [fullProfiles, setFullProfiles] = useState<Map<string, JobProfile>>(new Map());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch profiles on mount
  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  // Load full profile data for cards
  useEffect(() => {
    const loadFullProfiles = async () => {
      const map = new Map<string, JobProfile>();
      for (const summary of profiles) {
        const full = await getProfile(summary.id);
        if (full) {
          map.set(summary.id, full);
        }
      }
      setFullProfiles(map);
    };

    if (profiles.length > 0) {
      loadFullProfiles();
    }
  }, [profiles, getProfile]);

  const handleCreate = async (data: JobProfileCreate) => {
    setIsSubmitting(true);
    const result = await createProfile(data);
    setIsSubmitting(false);
    if (result) {
      setView("list");
    }
  };

  const handleUpdate = async (data: JobProfileUpdate) => {
    if (!editingProfile) return;
    setIsSubmitting(true);
    const result = await updateProfile(editingProfile.id, data);
    setIsSubmitting(false);
    if (result) {
      setEditingProfile(null);
      setView("list");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this profile?")) return;
    await deleteProfile(id);
  };

  const handleSetDefault = async (id: string) => {
    await setDefault(id);
  };

  const handleEdit = (profile: JobProfile) => {
    setEditingProfile(profile);
    setView("edit");
  };

  const handleCancel = () => {
    setEditingProfile(null);
    setView("list");
  };

  // Loading state
  if (isLoading && profiles.length === 0) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Create/Edit form
  if (view === "create" || view === "edit") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {view === "create" ? "Create Profile" : "Edit Profile"}
          </h1>
          <p className="text-muted-foreground">
            {view === "create"
              ? "Set up a new job search profile"
              : "Update your job search profile settings"}
          </p>
        </div>

        <ProfileForm
          profile={editingProfile}
          onSave={view === "create" ? handleCreate : handleUpdate}
          onCancel={handleCancel}
          isLoading={isSubmitting}
        />
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Search Profiles</h1>
          <p className="text-muted-foreground">
            Manage your job search profiles and preferences
          </p>
        </div>
        <Button onClick={() => setView("create")}>
          <Plus className="mr-2 h-4 w-4" />
          New Profile
        </Button>
      </div>

      {/* Error state */}
      {error && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="py-4">
            <p className="text-destructive text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {profiles.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 rounded-full bg-purple-500/10 p-4">
              <FileText className="h-10 w-10 text-purple-600" />
            </div>
            <h2 className="mb-2 text-xl font-semibold">No Profiles Yet</h2>
            <p className="text-muted-foreground mb-4 max-w-md">
              Create your first job search profile to get started. Link your resume and
              set preferences to help the AI find the best job matches for you.
            </p>
            <Button onClick={() => setView("create")}>
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Profile
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Profiles list */}
      {profiles.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {profiles.map((summary) => {
            const fullProfile = fullProfiles.get(summary.id);
            if (!fullProfile) {
              return (
                <Card key={summary.id}>
                  <CardContent className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </CardContent>
                </Card>
              );
            }
            return (
              <ProfileCard
                key={summary.id}
                profile={fullProfile}
                onEdit={() => handleEdit(fullProfile)}
                onDelete={() => handleDelete(summary.id)}
                onSetDefault={() => handleSetDefault(summary.id)}
                isLoading={isLoading}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
