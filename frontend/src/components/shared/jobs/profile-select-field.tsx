"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useJobProfiles } from "@/hooks/use-job-profiles";
import { Combobox } from "@/components/shared/forms";
import { Button, Label } from "@/components/ui";
import { cn } from "@/lib/utils";
import { AlertTriangle, User } from "lucide-react";

interface ProfileSelectFieldProps {
  id: string;
  value: unknown;
  onChange: (value: string | undefined) => void;
  required?: boolean;
  description?: string;
}

const UNSET_PROFILE_VALUE = "__default__";

/**
 * A specialized select field for choosing a job profile.
 * Fetches profiles on mount and renders them with badges for default and resume status.
 */
export function ProfileSelectField({
  id,
  value,
  onChange,
  required,
  description,
}: ProfileSelectFieldProps) {
  const { profiles, isLoading, error, hasProfiles } = useJobProfiles();
  const profilesById = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles]
  );

  // No profiles - show prominent CTA
  if (!isLoading && !hasProfiles) {
    return (
      <div className="space-y-2">
        <Label htmlFor={id} className="flex items-center gap-1">
          Profile
          {required && <span className="text-destructive">*</span>}
        </Label>
        <div className="rounded-lg border-2 border-dashed border-amber-500/50 bg-amber-500/5 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-amber-500/10 p-2">
              <User className="h-5 w-5 text-amber-500" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-amber-600 dark:text-amber-400">
                No Job Profiles Found
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                Create a job profile with your resume to prep jobs with the right context.
              </p>
              <Button asChild className="mt-3 bg-amber-500 text-white hover:bg-amber-600">
                <Link href="/jobs/profiles">Create Profile</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-2">
        <Label htmlFor={id} className="flex items-center gap-1">
          Profile
          {required && <span className="text-destructive">*</span>}
        </Label>
        <div className="bg-muted/50 flex h-10 w-full animate-pulse items-center rounded-md border px-3">
          <span className="text-muted-foreground text-sm">Loading profiles...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-2">
        <Label htmlFor={id} className="flex items-center gap-1">
          Profile
          {required && <span className="text-destructive">*</span>}
        </Label>
        <div className="border-destructive/50 bg-destructive/5 flex h-10 w-full items-center gap-2 rounded-md border px-3">
          <AlertTriangle className="text-destructive h-4 w-4" />
          <span className="text-destructive text-sm">{error}</span>
        </div>
      </div>
    );
  }

  // Find the default profile
  const defaultProfile = profiles.find((p) => p.is_default);
  const selectedValue = typeof value === "string" && value ? value : UNSET_PROFILE_VALUE;
  const selectedProfile = typeof value === "string" ? profilesById.get(value) : undefined;

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="flex items-center gap-1">
        Profile
        {required && <span className="text-destructive">*</span>}
      </Label>
      <Combobox
        triggerId={id}
        value={selectedValue}
        onValueChange={(nextValue) =>
          onChange(nextValue === UNSET_PROFILE_VALUE ? undefined : nextValue)
        }
        options={[
          {
            value: UNSET_PROFILE_VALUE,
            label: defaultProfile ? `Use default (${defaultProfile.name})` : "Select a profile...",
          },
          ...profiles.map((profile) => ({
            value: profile.id,
            label: profile.name,
            keywords: [
              profile.name,
              profile.resume_name ?? "",
              profile.is_default ? "default" : "",
              profile.has_resume ? "resume" : "no resume",
            ],
          })),
        ]}
        placeholder={
          defaultProfile ? `Use default (${defaultProfile.name})` : "Select a profile..."
        }
        searchPlaceholder="Search profiles..."
        renderOption={(option) => {
          const profile = profilesById.get(option.value);

          if (!profile) {
            return option.label;
          }

          return (
            <div className="flex min-w-0 flex-col">
              <span className="truncate">
                {profile.name}
                {profile.is_default ? " (default)" : ""}
              </span>
              {!profile.has_resume ? (
                <span className="text-muted-foreground text-xs">No resume linked</span>
              ) : profile.resume_name ? (
                <span className="text-muted-foreground text-xs">{profile.resume_name}</span>
              ) : null}
            </div>
          );
        }}
      />

      {/* Show selected profile info */}
      {typeof value === "string" && value && <SelectedProfileInfo profile={selectedProfile} />}

      {/* Description */}
      {description && <p className="text-muted-foreground text-xs">{description}</p>}

      {/* Link to manage profiles */}
      <Link
        href="/jobs/profiles"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
      >
        <User className="h-3 w-3" />
        Manage profiles
      </Link>
    </div>
  );
}

/**
 * Shows details about the selected profile.
 */
function SelectedProfileInfo({
  profile,
}: {
  profile?: {
    name: string;
    has_resume: boolean;
    has_cover_letter_full_name: boolean;
    resume_name: string | null;
  };
}) {
  if (!profile) return null;

  return (
    <div className="space-y-2 rounded-md border px-3 py-2 text-sm">
      <div
        className={cn(
          "flex items-center gap-2",
          profile.has_resume
            ? "text-green-600 dark:text-green-400"
            : "text-amber-600 dark:text-amber-400"
        )}
      >
        {profile.has_resume ? (
          <span>✓ Resume: {profile.resume_name}</span>
        ) : (
          <>
            <AlertTriangle className="h-4 w-4" />
            <span>No resume linked to this profile</span>
          </>
        )}
      </div>
      <div
        className={cn(
          "flex items-center gap-2",
          profile.has_cover_letter_full_name
            ? "text-green-600 dark:text-green-400"
            : "text-amber-600 dark:text-amber-400"
        )}
      >
        {profile.has_cover_letter_full_name ? (
          <span>✓ Cover-letter full name configured</span>
        ) : (
          <>
            <AlertTriangle className="h-4 w-4" />
            <span>Add a full name for cover-letter PDFs</span>
          </>
        )}
      </div>
    </div>
  );
}
