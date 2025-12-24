/**
 * Job-related types for the job search pipeline.
 */

/**
 * Status of a job in the user's workflow.
 */
export type JobStatus = "new" | "reviewed" | "applied" | "rejected" | "interviewing";

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
  reviewed: number;
  applied: number;
  rejected: number;
  interviewing: number;
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
 * Job profile with resume link and preferences.
 * A user can have multiple profiles with different configurations.
 */
export interface JobProfile {
  id: string;
  user_id: string;
  name: string;
  is_default: boolean;
  resume_id: string | null;
  resume: ResumeInfo | null;
  target_roles: string[] | null;
  target_locations: string[] | null;
  min_score_threshold: number;
  preferences: Record<string, unknown> | null;
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
  target_roles?: string[] | null;
  target_locations?: string[] | null;
  min_score_threshold?: number;
  preferences?: Record<string, unknown> | null;
}

/**
 * Partial update to profile.
 */
export interface JobProfileUpdate {
  name?: string;
  is_default?: boolean;
  resume_id?: string | null;
  target_roles?: string[] | null;
  target_locations?: string[] | null;
  min_score_threshold?: number;
  preferences?: Record<string, unknown> | null;
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
  is_active: boolean;
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
  is_active: boolean;
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
  is_active?: boolean;
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

