"use client";

import { useState, useEffect } from "react";
import { useJobProfiles } from "@/hooks";
import { Button, Card, CardContent } from "@/components/ui";
import { ProfileForm, type ProfileFormData } from "./profile-form";
import { ProfileCard } from "./profile-card";
import type { JobProfile, JobProfileCreate, JobProfileUpdate } from "@/types";
import { Loader2, Plus, UserCircle } from "lucide-react";

export function ProfilesTab() {
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

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

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

  const handleCreate = async (data: ProfileFormData) => {
    setIsSubmitting(true);
    const result = await createProfile(data as JobProfileCreate);
    setIsSubmitting(false);
    if (result) {
      setView("list");
    }
  };

  const handleUpdate = async (data: ProfileFormData) => {
    if (!editingProfile) return;
    setIsSubmitting(true);
    const result = await updateProfile(editingProfile.id, data as JobProfileUpdate);
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

  if (isLoading && profiles.length === 0) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (view === "create" || view === "edit") {
    return (
      <ProfileForm
        profile={editingProfile}
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
        <p className="text-sm text-muted-foreground">
          Configure your job search preferences and linked resumes
        </p>
        <Button onClick={() => setView("create")} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          New Profile
        </Button>
      </div>

      {error && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="py-4">
            <p className="text-destructive text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {profiles.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 rounded-full bg-purple-500/10 p-4">
              <UserCircle className="h-10 w-10 text-purple-600" />
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

