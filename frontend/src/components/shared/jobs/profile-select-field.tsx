"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useJobProfiles } from "@/hooks/use-job-profiles";
import {
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";
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
  const { profiles, isLoading, error, fetchProfiles, hasProfiles } = useJobProfiles();

  // Fetch profiles on mount
  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

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
                Create a job profile with your resume to start searching for jobs.
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

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="flex items-center gap-1">
        Profile
        {required && <span className="text-destructive">*</span>}
      </Label>
      <Select
        value={selectedValue}
        onValueChange={(nextValue) =>
          onChange(nextValue === UNSET_PROFILE_VALUE ? undefined : nextValue)
        }
      >
        <SelectTrigger id={id} className="w-full" aria-required={required}>
          <SelectValue
            placeholder={
              defaultProfile ? `Use default (${defaultProfile.name})` : "Select a profile..."
            }
          />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNSET_PROFILE_VALUE}>
            {defaultProfile ? `Use default (${defaultProfile.name})` : "Select a profile..."}
          </SelectItem>
          {profiles.map((profile) => (
            <SelectItem key={profile.id} value={profile.id}>
              <span>
                {profile.name}
                {profile.is_default ? " (default)" : ""}
                {!profile.has_resume ? " - no resume" : ""}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Show selected profile info */}
      {typeof value === "string" && value && (
        <SelectedProfileInfo profile={profiles.find((p) => p.id === value)} />
      )}

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
  profile?: { name: string; has_resume: boolean; resume_name: string | null };
}) {
  if (!profile) return null;

  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2 text-sm",
        profile.has_resume
          ? "border-green-500/20 bg-green-500/5"
          : "border-amber-500/30 bg-amber-500/5"
      )}
    >
      {profile.has_resume ? (
        <p className="text-green-600 dark:text-green-400">✓ Resume: {profile.resume_name}</p>
      ) : (
        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4" />
          <span>No resume linked to this profile</span>
        </div>
      )}
    </div>
  );
}
