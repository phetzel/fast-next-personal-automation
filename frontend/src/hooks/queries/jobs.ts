"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type {
  Job,
  JobFilters,
  JobListResponse,
  JobProfile,
  JobProfileSummary,
  JobStats,
  Project,
  ProjectSummary,
  ProjectTextResponse,
  Resume,
  ResumeSummary,
  Story,
  StorySummary,
} from "@/types";
import { toSearchParams } from "./utils";

export function useJobsListQuery(filters: Partial<JobFilters>) {
  const queryString = toSearchParams(filters);

  return useQuery({
    queryKey: queryKeys.jobs.list(filters),
    queryFn: () => apiClient.get<JobListResponse>(queryString ? `/jobs?${queryString}` : "/jobs"),
  });
}

export function useJobStatsQuery() {
  return useQuery({
    queryKey: queryKeys.jobs.stats(),
    queryFn: () => apiClient.get<JobStats>("/jobs/stats"),
  });
}

export function useJobQuery(jobId: string | null) {
  return useQuery({
    queryKey: jobId ? queryKeys.jobs.detail(jobId) : [...queryKeys.jobs.all, "detail", null],
    queryFn: () => apiClient.get<Job>(`/jobs/${jobId}`),
    enabled: Boolean(jobId),
  });
}

export function useJobProfilesQuery() {
  return useQuery({
    queryKey: queryKeys.jobs.profiles(),
    queryFn: () => apiClient.get<JobProfileSummary[]>("/job-profiles"),
  });
}

export function useJobProfileQuery(profileId: string | null) {
  return useQuery({
    queryKey: profileId ? queryKeys.jobs.profile(profileId) : [...queryKeys.jobs.profiles(), null],
    queryFn: () => apiClient.get<JobProfile>(`/job-profiles/${profileId}`),
    enabled: Boolean(profileId),
  });
}

export function useDefaultJobProfileQuery() {
  return useQuery({
    queryKey: [...queryKeys.jobs.profiles(), "default"],
    queryFn: () => apiClient.get<JobProfile | null>("/job-profiles/default"),
  });
}

export function useResumesQuery() {
  return useQuery({
    queryKey: queryKeys.jobs.resumes(),
    queryFn: () => apiClient.get<ResumeSummary[]>("/resumes"),
  });
}

export function useResumeQuery(resumeId: string | null) {
  return useQuery({
    queryKey: resumeId
      ? [...queryKeys.jobs.resumes(), resumeId]
      : [...queryKeys.jobs.resumes(), null],
    queryFn: () => apiClient.get<Resume>(`/resumes/${resumeId}`),
    enabled: Boolean(resumeId),
  });
}

export function useStoriesQuery() {
  return useQuery({
    queryKey: queryKeys.jobs.stories(),
    queryFn: () => apiClient.get<StorySummary[]>("/stories"),
  });
}

export function useStoryQuery(storyId: string | null) {
  return useQuery({
    queryKey: storyId
      ? [...queryKeys.jobs.stories(), storyId]
      : [...queryKeys.jobs.stories(), null],
    queryFn: () => apiClient.get<Story>(`/stories/${storyId}`),
    enabled: Boolean(storyId),
  });
}

export function useProjectsQuery() {
  return useQuery({
    queryKey: queryKeys.jobs.projects(),
    queryFn: () => apiClient.get<ProjectSummary[]>("/projects"),
  });
}

export function useProjectQuery(projectId: string | null) {
  return useQuery({
    queryKey: projectId
      ? [...queryKeys.jobs.projects(), projectId]
      : [...queryKeys.jobs.projects(), null],
    queryFn: () => apiClient.get<Project>(`/projects/${projectId}`),
    enabled: Boolean(projectId),
  });
}

export function useProjectTextQuery(projectId: string | null) {
  return useQuery({
    queryKey: projectId
      ? [...queryKeys.jobs.projects(), projectId, "text"]
      : [...queryKeys.jobs.projects(), null, "text"],
    queryFn: () => apiClient.get<ProjectTextResponse>(`/projects/${projectId}/text`),
    enabled: Boolean(projectId),
  });
}
