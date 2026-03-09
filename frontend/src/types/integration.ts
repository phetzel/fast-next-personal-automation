/**
 * OpenClaw integration types.
 */

export interface OpenClawToken {
  id: string;
  name: string;
  scopes: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
  last_used_at: string | null;
  expires_at: string | null;
}

export interface OpenClawTokenListResponse {
  items: OpenClawToken[];
  total: number;
}

export interface OpenClawTokenCreateRequest {
  name: string;
  scopes?: string[];
  expires_at?: string | null;
}

export interface OpenClawTokenCreateResponse {
  token: string;
  token_info: OpenClawToken;
}
