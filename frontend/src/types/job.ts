/**
 * Job-related types for the jobs workflow.
 */
import type { LinkedEmailContext } from "./email";

/**
 * All possible job statuses.
 * Order matters - this is the linear flow order.
 */
export const JOB_STATUSES = [
  "new",
  "analyzed",
  "prepped",
  "reviewed",
  "applied",
  "interviewing",
  "rejected",
] as const;

/**
 * Status of a job in the user's workflow.
 */
export type JobStatus = (typeof JOB_STATUSES)[number];

export const PRE_APPLIED_JOB_STATUSES: JobStatus[] = ["new", "analyzed", "prepped", "reviewed"];

export const POST_APPLIED_JOB_STATUSES: JobStatus[] = ["applied", "interviewing", "rejected"];

export const DEFAULT_JOB_STATUS_FILTERS: JobStatus[] = [...PRE_APPLIED_JOB_STATUSES];

/**
 * Metadata for each job status including display info and allowed transitions.
 */
export const JOB_STATUS_CONFIG: Record<
  JobStatus,
  {
    label: string;
    description: string;
    /** Statuses that can transition TO this status */
    allowedFrom: JobStatus[];
  }
> = {
  new: {
    label: "New",
    description: "Added and waiting for application requirements",
    allowedFrom: [], // Initial state, nothing transitions to new
  },
  analyzed: {
    label: "Analyzed",
    description: "Application requirements captured and ready for prep",
    allowedFrom: [],
  },
  prepped: {
    label: "Prepped",
    description: "Prep notes and optional application materials generated",
    allowedFrom: ["analyzed"],
  },
  reviewed: {
    label: "Reviewed",
    description: "Ready to apply",
    allowedFrom: ["prepped"],
  },
  applied: {
    label: "Applied",
    description: "Application submitted",
    allowedFrom: ["new", "analyzed", "prepped", "reviewed"],
  },
  interviewing: {
    label: "Interviewing",
    description: "In interview process",
    allowedFrom: ["applied"],
  },
  rejected: {
    label: "Rejected",
    description: "Application was declined",
    allowedFrom: ["applied", "interviewing"],
  },
};

/**
 * Check if a status transition is allowed.
 */
export function canTransitionTo(from: JobStatus, to: JobStatus): boolean {
  if (from === to) return false;
  return JOB_STATUS_CONFIG[to].allowedFrom.includes(from);
}

/**
 * Get all statuses that the given status can transition to.
 */
export function getAllowedTransitions(from: JobStatus): JobStatus[] {
  return JOB_STATUSES.filter((status) => canTransitionTo(from, status));
}

/**
 * How a job was discovered/added to the system.
 */
export type IngestionSource = "scrape" | "email" | "manual" | "openclaw";

/**
 * A job listing from the database.
 */
export interface Job {
  id: string;
  user_id: string;
  profile_id: string | null;
  title: string;
  company: string;
  location: string | null;
  description: string | null;
  job_url: string;
  salary_range: string | null;
  date_posted: string | null;
  source: string | null;
  ingestion_source: IngestionSource | null;
  relevance_score: number | null;
  reasoning: string | null;
  status: JobStatus;
  search_terms: string | null;
  notes: string | null;
  // Additional scrape fields
  is_remote: boolean | null;
  job_type: string | null;
  company_url: string | null;
  // Prep materials
  cover_letter: string | null;
  cover_letter_file_path: string | null;
  cover_letter_generated_at: string | null;
  prep_notes: string | null;
  prepped_at: string | null;
  application_type: "easy_apply" | "ats" | "direct" | "email" | "unknown" | null;
  application_url: string | null;
  requires_cover_letter: boolean | null;
  cover_letter_requested?: boolean | null;
  requires_resume: boolean | null;
  detected_fields: Record<string, unknown> | null;
  screening_questions: Array<Record<string, unknown>> | null;
  screening_answers: Record<string, string> | null;
  ats_family?: string | null;
  analysis_source?: string | null;
  analyzed_at: string | null;
  has_application_analysis?: boolean;
  is_prep_eligible?: boolean;
  applied_at: string | null;
  application_method: string | null;
  confirmation_code: string | null;
  linked_email: LinkedEmailContext | null;
  created_at: string;
  updated_at: string | null;
}

/**
 * True when the job currently has real cover-letter text that can be rendered to PDF.
 */
export function hasCoverLetterText(coverLetter: string | null | undefined): boolean {
  const text = coverLetter?.trim();
  return Boolean(text);
}

/**
 * Reviewed jobs only need PDF generation when a real cover letter exists or
 * application analysis explicitly says one is required.
 */
export function shouldGenerateReviewPdf(
  job: Pick<Job, "cover_letter" | "requires_cover_letter"> & {
    cover_letter_requested?: boolean | null;
  },
  draftCoverLetter?: string | null
): boolean {
  if (hasCoverLetterText(draftCoverLetter ?? job.cover_letter)) {
    return true;
  }

  return job.requires_cover_letter === true || job.cover_letter_requested === true;
}

export function getScreeningQuestionText(question: Record<string, unknown>): string {
  const candidates = [
    question.question,
    question.label,
    question.prompt,
    question.name,
    question.text,
  ];

  const match = candidates.find(
    (value): value is string => typeof value === "string" && value.trim().length > 0
  );

  return match?.trim() ?? "";
}

export function getOrderedScreeningAnswers(
  job: Pick<Job, "screening_questions" | "screening_answers">
): Array<{ question: string; answer: string }> {
  const orderedQuestions =
    job.screening_questions?.map(getScreeningQuestionText).filter(Boolean) ?? [];
  const answers = job.screening_answers ?? {};
  const seen = new Set<string>();
  const ordered = orderedQuestions.flatMap((question) => {
    const answer = answers[question];
    if (!answer) {
      return [];
    }
    seen.add(question);
    return [{ question, answer }];
  });

  const remaining = Object.entries(answers)
    .filter(([question, answer]) => Boolean(question.trim()) && Boolean(answer.trim()))
    .filter(([question]) => !seen.has(question))
    .map(([question, answer]) => ({ question, answer }));

  return [...ordered, ...remaining];
}

/**
 * Abbreviated job info for lists.
 */
export interface JobSummary {
  id: string;
  title: string;
  company: string;
  location: string | null;
  relevance_score: number | null;
  status: JobStatus;
  job_url: string;
}

/**
 * Response from listing jobs.
 */
export interface JobListResponse {
  jobs: Job[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

/**
 * Statistics about user's jobs.
 */
export interface JobStats {
  total: number;
  new: number;
  analyzed: number;
  prepped: number;
  reviewed: number;
  applied: number;
  interviewing: number;
  rejected: number;
  avg_score: number | null;
  high_scoring: number;
}

/**
 * Filters for querying jobs.
 */
export interface JobFilters {
  status?: JobStatus;
  statuses?: JobStatus[];
  source?: string;
  ingestion_source?: IngestionSource;
  min_score?: number;
  max_score?: number;
  search?: string;
  prep_eligible?: boolean;
  posted_within_hours?: number;
  page?: number;
  page_size?: number;
  sort_by?: "created_at" | "relevance_score" | "date_posted" | "company";
  sort_order?: "asc" | "desc";
}

/**
 * Request to update a job.
 */
export interface JobUpdate {
  status?: JobStatus;
  notes?: string;
  cover_letter?: string;
  prep_notes?: string;
}

export interface ManualAnalyzeRequest {
  requires_cover_letter?: boolean;
  screening_questions?: string[];
}

export interface ManualJobCreateRequest {
  title: string;
  company: string;
  job_url: string;
  location?: string | null;
  description?: string | null;
  salary_range?: string | null;
  date_posted?: string | null;
  source?: string | null;
  is_remote?: boolean | null;
  job_type?: string | null;
  company_url?: string | null;
  profile_id?: string | null;
  notes?: string | null;
}

// ===========================================================================
// Resume Types
// ===========================================================================

/**
 * A user's uploaded resume file.
 */
export interface Resume {
  id: string;
  user_id: string;
  name: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  is_primary: boolean;
  has_text: boolean;
  created_at: string;
  updated_at: string | null;
}

/**
 * Summary of resume for lists and selectors.
 */
export interface ResumeSummary {
  id: string;
  name: string;
  original_filename: string;
  is_primary: boolean;
  has_text: boolean;
}

/**
 * Resume info embedded in profile response.
 */
export interface ResumeInfo {
  id: string;
  name: string;
  original_filename: string;
  has_text: boolean;
}

// ===========================================================================
// Job Profile Types
// ===========================================================================

/**
 * Story info embedded in profile response.
 */
export interface StoryInfo {
  id: string;
  name: string;
}

/**
 * Project info embedded in profile response.
 */
export interface ProjectInfo {
  id: string;
  name: string;
  has_text: boolean;
}

/**
 * Job profile with resume, story, and projects link and preferences.
 * A user can have multiple profiles with different configurations.
 */
export interface JobProfile {
  id: string;
  user_id: string;
  name: string;
  is_default: boolean;
  resume_id: string | null;
  resume: ResumeInfo | null;
  story_id: string | null;
  story: StoryInfo | null;
  project_ids: string[] | null;
  projects: ProjectInfo[] | null;
  target_roles: string[] | null;
  target_locations: string[] | null;
  min_score_threshold: number;
  preferences: Record<string, unknown> | null;
  // Contact info for cover letters
  contact_full_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  contact_location: string | null;
  contact_website: string | null;
  created_at: string;
  updated_at: string | null;
}

/**
 * Summary of profile for lists.
 */
export interface JobProfileSummary {
  id: string;
  name: string;
  is_default: boolean;
  has_resume: boolean;
  has_cover_letter_full_name: boolean;
  resume_name: string | null;
  has_story: boolean;
  story_name: string | null;
  project_count: number;
  target_roles_count: number;
  min_score_threshold: number;
}

/**
 * Request to create a profile.
 */
export interface JobProfileCreate {
  name: string;
  is_default?: boolean;
  resume_id?: string | null;
  story_id?: string | null;
  project_ids?: string[] | null;
  target_roles?: string[] | null;
  target_locations?: string[] | null;
  min_score_threshold?: number;
  preferences?: Record<string, unknown> | null;
  // Contact info for cover letters
  contact_full_name?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  contact_location?: string | null;
  contact_website?: string | null;
}

/**
 * Partial update to profile.
 */
export interface JobProfileUpdate {
  name?: string;
  is_default?: boolean;
  resume_id?: string | null;
  story_id?: string | null;
  project_ids?: string[] | null;
  target_roles?: string[] | null;
  target_locations?: string[] | null;
  min_score_threshold?: number;
  preferences?: Record<string, unknown> | null;
  // Contact info for cover letters
  contact_full_name?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  contact_location?: string | null;
  contact_website?: string | null;
}

// ===========================================================================
// Story Types
// ===========================================================================

/**
 * A user's story/narrative text.
 */
export interface Story {
  id: string;
  user_id: string;
  name: string;
  content: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string | null;
}

/**
 * Summary of story for lists and selectors.
 */
export interface StorySummary {
  id: string;
  name: string;
  is_primary: boolean;
  content_preview: string;
}

/**
 * Request to create a story.
 */
export interface StoryCreate {
  name: string;
  content: string;
  is_primary?: boolean;
}

/**
 * Partial update to story.
 */
export interface StoryUpdate {
  name?: string;
  content?: string;
  is_primary?: boolean;
}

// ===========================================================================
// Project Types
// ===========================================================================

/**
 * A user's project description.
 */
export interface Project {
  id: string;
  user_id: string;
  name: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  has_text: boolean;
  created_at: string;
  updated_at: string | null;
}

/**
 * Summary of project for lists.
 */
export interface ProjectSummary {
  id: string;
  name: string;
  original_filename: string;
  has_text: boolean;
}

/**
 * Project text content response.
 */
export interface ProjectTextResponse {
  id: string;
  name: string;
  text_content: string | null;
}

/**
 * Partial update to project.
 */
export interface ProjectUpdate {
  name?: string;
}

// ===========================================================================
// Pipeline Error Types
// ===========================================================================

/**
 * Structured error returned when a job profile is required but not available.
 * The frontend uses this to show a profile selector instead of a generic error.
 */
export interface ProfileRequiredError {
  error_type: "profile_required";
  message: string;
  available_profiles: JobProfileSummary[];
  create_profile_url: string;
}
