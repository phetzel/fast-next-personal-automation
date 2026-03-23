/**
 * Email source and related types
 */

export interface EmailSource {
  id: string;
  email_address: string;
  provider: string;
  is_active: boolean;
  last_sync_at: string | null;
  last_sync_error: string | null;
  last_triage_at: string | null;
  last_triage_error: string | null;
  custom_senders: string[] | null;
  created_at: string;
  updated_at: string | null;
}

export interface EmailSourceStats {
  total_messages: number;
  total_jobs_extracted: number;
  successful_parses: number;
  failed_parses: number;
}

export interface EmailSourceWithStats extends EmailSource {
  stats: EmailSourceStats;
}

export interface EmailMessage {
  id: string;
  sync_id?: string | null;
  gmail_message_id: string;
  gmail_thread_id?: string | null;
  subject: string | null;
  from_address: string;
  to_address?: string | null;
  received_at: string | null;
  jobs_extracted: number;
  parser_used: string | null;
  processing_error: string | null;
  processed_at: string | null;
}

export type EmailBucket =
  | "now"
  | "jobs"
  | "finance"
  | "newsletter"
  | "notifications"
  | "review"
  | "done";

export interface EmailTriageMessage extends Omit<EmailMessage, "jobs_extracted" | "parser_used"> {
  source_id: string;
  source_email_address: string;
  bucket: EmailBucket | null;
  triage_status: "pending" | "classified" | "reviewed" | "ignored";
  triage_confidence: number | null;
  actionability_score: number | null;
  summary: string | null;
  requires_review: boolean;
  unsubscribe_candidate: boolean;
  is_vip: boolean;
  triaged_at: string | null;
  last_action_at: string | null;
}

export interface EmailTriageRunInput {
  source_id?: string;
  force_full_run?: boolean;
  lookback_hours?: number | null;
  limit_per_source?: number;
}

export interface EmailTriageRunResult {
  messages_scanned: number;
  messages_triaged: number;
  bucket_counts: Record<string, number>;
  sources_processed: number;
  errors: string[];
}

export interface EmailTriageLastRun {
  id: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  messages_scanned: number;
  messages_triaged: number;
  bucket_counts: Record<string, number>;
}

export interface EmailTriageStats {
  by_bucket: Record<string, number>;
  total_triaged: number;
  review_count: number;
  unsubscribe_count: number;
  last_run: EmailTriageLastRun | null;
}

export interface EmailTriageListResponse {
  items: EmailTriageMessage[];
  total: number;
  limit: number;
  offset: number;
}

export interface DefaultSenderInfo {
  domain: string;
  display_name: string;
  parser_name: string;
}

export interface EmailConfig {
  default_senders: DefaultSenderInfo[];
  sync_interval_minutes: number;
}

export interface EmailSyncOutput {
  emails_processed: number;
  jobs_extracted: number;
  jobs_saved: number;
  errors: string[];
}

/**
 * Email sync record - tracks a sync operation
 */
export interface EmailSync {
  id: string;
  user_id: string;
  started_at: string;
  completed_at: string | null;
  status: "pending" | "running" | "completed" | "failed";
  error_message: string | null;
  sources_synced: number;
  emails_fetched: number;
  emails_processed: number;
  sync_metadata: {
    jobs_extracted?: number;
    jobs_analyzed?: number;
    jobs_saved?: number;
    high_scoring?: number;
  } | null;
}

export interface EmailSyncListResponse {
  items: EmailSync[];
  total: number;
  limit: number;
  offset: number;
}

export interface EmailSyncStats {
  total_syncs: number;
  successful_syncs: number;
  failed_syncs: number;
  total_emails_processed: number;
  total_jobs_extracted: number;
  total_jobs_saved: number;
  last_sync: EmailSync | null;
}
