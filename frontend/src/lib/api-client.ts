/**
 * Client-side API client.
 * All requests go through Next.js API routes (/api/*), never directly to the backend.
 * This keeps the backend URL hidden from the browser.
 */

import { handleAuthFailure } from "@/lib/auth-failure";
import { extractErrorMessage } from "@/lib/error-utils";

export class ApiError extends Error {
  constructor(
    public status: number,
    public message: string,
    public data?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  params?: Record<string, string>;
  body?: unknown;
}

const AUTH_RETRY_EXCLUDED_ENDPOINTS = new Set([
  "/auth/login",
  "/auth/register",
  "/auth/logout",
  "/auth/refresh",
]);

class ApiClient {
  private refreshPromise: Promise<boolean> | null = null;

  private async request<T>(
    endpoint: string,
    options: RequestOptions = {},
    hasRetried = false
  ): Promise<T> {
    const { params, body, ...fetchOptions } = options;

    let url = `/api${endpoint}`;

    if (params) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }

    const headers = new Headers(fetchOptions.headers);
    const serializedBody =
      body === undefined || body instanceof FormData || typeof body === "string"
        ? body
        : JSON.stringify(body);

    if (serializedBody !== undefined && !(serializedBody instanceof FormData)) {
      headers.set("Content-Type", headers.get("Content-Type") ?? "application/json");
    }

    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      body: serializedBody,
    });

    if (!response.ok) {
      const errorData = await this.parseResponseBody(response);

      if (response.status === 401 && !hasRetried && !AUTH_RETRY_EXCLUDED_ENDPOINTS.has(endpoint)) {
        const refreshed = await this.refreshSession();
        if (refreshed) {
          return this.request<T>(endpoint, options, true);
        }

        handleAuthFailure();
      }

      throw new ApiError(
        response.status,
        extractErrorMessage(errorData, "Request failed"),
        errorData
      );
    }

    return (await this.parseResponseBody(response)) as T;
  }

  private async refreshSession(): Promise<boolean> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const response = await fetch("/api/auth/refresh", {
          method: "POST",
        });
        return response.ok;
      } catch {
        return false;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  private async parseResponseBody(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  get<T>(endpoint: string, options?: RequestOptions) {
    return this.request<T>(endpoint, { ...options, method: "GET" });
  }

  post<T>(endpoint: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>(endpoint, { ...options, method: "POST", body });
  }

  put<T>(endpoint: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>(endpoint, { ...options, method: "PUT", body });
  }

  patch<T>(endpoint: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>(endpoint, { ...options, method: "PATCH", body });
  }

  delete<T>(endpoint: string, options?: RequestOptions) {
    return this.request<T>(endpoint, { ...options, method: "DELETE" });
  }
}

export const apiClient = new ApiClient();
