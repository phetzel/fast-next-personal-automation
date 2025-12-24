/**
 * Pipeline-related types.
 */

/**
 * JSON Schema type definitions for dynamic form generation.
 */
export interface JSONSchemaProperty {
  type: "string" | "number" | "integer" | "boolean" | "array" | "object";
  description?: string;
  default?: unknown;
  enum?: string[];
  /** Standard formats plus custom x-profile-select for job profile selection */
  format?: "email" | "date" | "date-time" | "uri" | "uuid" | "x-profile-select";
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  items?: JSONSchemaProperty;
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
  /** Custom extension to hide field from form (uses default value) */
  "x-hidden"?: boolean;
}

export interface JSONSchema {
  type: "object";
  title?: string;
  description?: string;
  properties: Record<string, JSONSchemaProperty>;
  required?: string[];
}

/**
 * Information about a registered pipeline.
 */
export interface PipelineInfo {
  name: string;
  description: string;
  input_schema: JSONSchema;
  output_schema: JSONSchema;
  /** Tags for fine-grained filtering (e.g., ["jobs", "ai"]) */
  tags: string[];
  /** Primary area association for grouping (e.g., "jobs") */
  area: string | null;
}

/**
 * Response from listing pipelines.
 */
export interface PipelineListResponse {
  pipelines: PipelineInfo[];
  total: number;
}

/**
 * Response from executing a pipeline.
 */
export interface PipelineExecuteResponse {
  success: boolean;
  output: Record<string, unknown> | null;
  error: string | null;
  metadata: Record<string, unknown>;
}

/**
 * Execution state for tracking pipeline runs.
 */
export type ExecutionStatus = "idle" | "running" | "success" | "error";

export interface ExecutionState {
  status: ExecutionStatus;
  result: PipelineExecuteResponse | null;
  startedAt: Date | null;
  completedAt: Date | null;
  /** The input that was used for this execution, used for retry */
  lastInput: Record<string, unknown> | null;
}

// ===========================================================================
// Pipeline Run History Types
// ===========================================================================

/**
 * Status of a pipeline run in the database.
 */
export type PipelineRunStatus = "pending" | "running" | "success" | "error" | "cancelled";

/**
 * How the pipeline was triggered.
 */
export type PipelineTriggerType = "api" | "webhook" | "agent" | "cron" | "manual";

/**
 * A single pipeline run record from the server.
 */
export interface PipelineRun {
  id: string;
  pipeline_name: string;
  status: PipelineRunStatus;
  trigger_type: PipelineTriggerType;
  user_id: string | null;
  input_data: Record<string, unknown> | null;
  output_data: Record<string, unknown> | null;
  error_message: string | null;
  run_metadata: Record<string, unknown> | null;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  created_at: string;
}

/**
 * Response from listing pipeline runs.
 */
export interface PipelineRunListResponse {
  runs: PipelineRun[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

/**
 * Statistics about pipeline runs.
 */
export interface PipelineRunStats {
  total: number;
  success: number;
  errors: number;
  success_rate: number;
  avg_duration_ms: number | null;
}

/**
 * Filters for querying pipeline runs.
 */
export interface PipelineRunFilters {
  pipeline_name?: string;
  status?: PipelineRunStatus;
  trigger_type?: PipelineTriggerType;
  started_after?: string;
  started_before?: string;
  success_only?: boolean;
  error_only?: boolean;
  my_runs_only?: boolean;
  page?: number;
  page_size?: number;
}

/**
 * Filters for querying available pipelines.
 */
export interface PipelineFilters {
  /** Filter by primary area (exact match) */
  area?: string;
  /** Filter by tags (must have ALL specified tags) */
  tags?: string[];
}

