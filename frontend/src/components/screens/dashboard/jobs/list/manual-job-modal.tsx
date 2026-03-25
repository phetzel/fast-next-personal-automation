"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
} from "@/components/ui";
import { ProfileSelectField } from "@/components/shared/jobs/profile-select-field";
import { useJobMutations } from "@/hooks";
import type { Job } from "@/types";
import { BriefcaseBusiness, Loader2, Plus } from "lucide-react";

interface ManualJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: (job: Job) => void;
}

const initialForm = {
  title: "",
  company: "",
  job_url: "",
  location: "",
  source: "",
  description: "",
  profile_id: undefined as string | undefined,
};

export function ManualJobModal({ isOpen, onClose, onComplete }: ManualJobModalProps) {
  const { createJob, error, clearError } = useJobMutations();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    if (isOpen) {
      setForm(initialForm);
      setIsSubmitting(false);
      clearError();
    }
  }, [clearError, isOpen]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    const job = await createJob({
      title: form.title.trim(),
      company: form.company.trim(),
      job_url: form.job_url.trim(),
      location: form.location.trim() || null,
      source: form.source.trim() || null,
      description: form.description.trim() || null,
      profile_id: form.profile_id ?? null,
    });

    setIsSubmitting(false);
    if (job) {
      onComplete?.(job);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BriefcaseBusiness className="h-5 w-5" />
            Add Manual Job
          </DialogTitle>
          <DialogDescription>
            Save a job manually for later analysis and prep. Manual jobs start in the `new` stage,
            and you can optionally attach a profile now for prep context.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="manual-title">Job Title</Label>
              <Input
                id="manual-title"
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({ ...current, title: event.target.value }))
                }
                placeholder="Senior Backend Engineer"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-company">Company</Label>
              <Input
                id="manual-company"
                value={form.company}
                onChange={(event) =>
                  setForm((current) => ({ ...current, company: event.target.value }))
                }
                placeholder="Example Co"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="manual-url">Job URL</Label>
            <Input
              id="manual-url"
              type="url"
              value={form.job_url}
              onChange={(event) =>
                setForm((current) => ({ ...current, job_url: event.target.value }))
              }
              placeholder="https://jobs.example.com/backend-engineer"
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="manual-location">Location</Label>
              <Input
                id="manual-location"
                value={form.location}
                onChange={(event) =>
                  setForm((current) => ({ ...current, location: event.target.value }))
                }
                placeholder="Remote"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-source">Source</Label>
              <Input
                id="manual-source"
                value={form.source}
                onChange={(event) =>
                  setForm((current) => ({ ...current, source: event.target.value }))
                }
                placeholder="linkedin"
              />
            </div>
          </div>

          <ProfileSelectField
            id="manual-profile"
            value={form.profile_id}
            onChange={(value) => setForm((current) => ({ ...current, profile_id: value }))}
            description="Optional. Prep uses this profile first and otherwise falls back to your default profile."
          />

          <div className="space-y-2">
            <Label htmlFor="manual-description">Description</Label>
            <Textarea
              id="manual-description"
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
              placeholder="Paste the job description if you have it."
              rows={6}
            />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex items-center justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Job
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
