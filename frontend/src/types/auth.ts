/**
 * Authentication types.
 */

export interface User {
  id: string;
  email: string;
  name?: string;
  full_name?: string | null;
  is_active: boolean;
  is_superuser?: boolean;
  created_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface LoginResponse {
  user: User;
  message: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
  full_name?: string;
}

export interface RegisterResponse {
  id: string;
  email: string;
  name?: string;
  full_name?: string | null;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface RefreshTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
