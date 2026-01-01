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
  gmail_message_id: string;
  subject: string;
  from_address: string;
  received_at: string;
  jobs_extracted: number;
  parser_used: string | null;
  processing_error: string | null;
  processed_at: string;
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

