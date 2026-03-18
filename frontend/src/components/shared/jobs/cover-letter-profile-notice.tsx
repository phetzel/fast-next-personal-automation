"use client";

import { useMemo } from "react";
import { AlertTriangle, User } from "lucide-react";
import { useJobProfiles } from "@/hooks/use-job-profiles";
import { StatusAlert } from "@/components/shared/feedback";
import { useAuthStore } from "@/stores";
import type { JobProfile, JobProfileSummary } from "@/types";

type ProfileLike = JobProfile | JobProfileSummary | null | undefined;

interface CoverLetterProfileNoticeProps {
  profileId?: string | null;
  className?: string;
}

function hasProfileFullName(profile: ProfileLike): boolean {
  if (!profile) {
    return false;
  }

  if ("has_cover_letter_full_name" in profile) {
    return profile.has_cover_letter_full_name;
  }

  return Boolean(profile.contact_full_name?.trim());
}

export function CoverLetterProfileNotice({ profileId, className }: CoverLetterProfileNoticeProps) {
  const { profiles, defaultProfile } = useJobProfiles();
  const authUser = useAuthStore((state) => state.user);

  const accountFullName = authUser?.full_name?.trim() || authUser?.name?.trim() || null;

  const resolvedProfile = useMemo(() => {
    if (profileId) {
      return profiles.find((profile) => profile.id === profileId) ?? null;
    }
    return defaultProfile ?? null;
  }, [defaultProfile, profileId, profiles]);

  const profileName = resolvedProfile?.name ?? "default profile";
  const profileHasName = hasProfileFullName(resolvedProfile);

  if (!profileHasName && !accountFullName) {
    return (
      <StatusAlert
        icon={AlertTriangle}
        variant="destructive"
        title="Cover Letter Header Incomplete"
        className={className}
      >
        Add a full name to {profileName} or your account profile before generating a cover-letter
        PDF.
      </StatusAlert>
    );
  }

  if (resolvedProfile && !profileHasName && accountFullName) {
    return (
      <StatusAlert icon={User} title="Profile Header Fallback" className={className}>
        {profileName} is missing a cover-letter full name. PDFs will use your account name until you
        add one to the profile.
      </StatusAlert>
    );
  }

  return null;
}
