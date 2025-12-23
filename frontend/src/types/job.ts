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
// User Profile Types
// ===========================================================================

/**
 * User profile with resume and job preferences.
 */
export interface UserProfile {
  id: string;
  user_id: string;
  resume_text: string | null;
  target_roles: string[] | null;
  target_locations: string[] | null;
  min_score_threshold: number;
  preferences: Record<string, unknown> | null;
  created_at: string;
  updated_at: string | null;
}

/**
 * Summary of profile status.
 */
export interface UserProfileSummary {
  has_profile: boolean;
  has_resume: boolean;
  target_roles_count: number;
  min_score_threshold: number;
}

/**
 * Request to create/update profile.
 */
export interface UserProfileCreate {
  resume_text?: string | null;
  target_roles?: string[] | null;
  target_locations?: string[] | null;
  min_score_threshold?: number;
  preferences?: Record<string, unknown> | null;
}

/**
 * Partial update to profile.
 */
export interface UserProfileUpdate {
  resume_text?: string | null;
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

