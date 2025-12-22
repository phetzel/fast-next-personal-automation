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
  format?: "email" | "date" | "date-time" | "uri" | "uuid";
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  items?: JSONSchemaProperty;
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
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
}

