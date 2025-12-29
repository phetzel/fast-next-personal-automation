/**
 * Job-related types for the job search pipeline.
 */

/**
 * All possible job statuses.
 * Order matters - this is the linear flow order.
 */
export const JOB_STATUSES = [
  "new",
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
    description: "Just scraped, not reviewed yet",
    allowedFrom: [], // Initial state, nothing transitions to new
  },
  prepped: {
    label: "Prepped",
    description: "Cover letter & notes generated",
    allowedFrom: ["new"],
  },
  reviewed: {
    label: "Reviewed",
    description: "Ready to apply, PDF generated",
    allowedFrom: ["prepped"],
  },
  applied: {
    label: "Applied",
    description: "Application submitted",
    allowedFrom: ["reviewed"],
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
 * A job listing from the database.
 */
export interface Job {
  id: string;
  user_id: string;
  title: string;
  company: string;
  location: string | null;
  description: string | null;
  job_url: string;
  salary_range: string | null;
  date_posted: string | null;
  source: string | null;
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
  created_at: string;
  updated_at: string | null;
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
  source?: string;
  min_score?: number;
  max_score?: number;
  search?: string;
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
// Job Search Pipeline Types
// ===========================================================================

/**
 * Input for the job search pipeline.
 */
export interface JobSearchInput {
  profile_id?: string;
  terms?: string[];
  locations?: string[];
  is_remote?: boolean;
  hours_old?: number;
  results_per_term?: number;
  min_score?: number;
  save_all?: boolean;
  scraper?: "jobspy" | "mock";
}

/**
 * Output from the job search pipeline.
 */
export interface JobSearchOutput {
  total_scraped: number;
  total_analyzed: number;
  jobs_saved: number;
  high_scoring: number;
  duplicates_skipped: number;
  top_jobs: JobSummary[];
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

