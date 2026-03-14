import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { backendFetch } from "@/lib/server-api";

vi.mock("@/lib/server-api", () => ({
  backendFetch: vi.fn(),
  BackendApiError: class BackendApiError extends Error {
    constructor(
      public status: number,
      public statusText: string,
      public data?: unknown
    ) {
      super(statusText);
    }
  },
  backendErrorMessage: vi.fn(),
}));

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the current user after issuing auth cookies", async () => {
    vi.mocked(backendFetch)
      .mockResolvedValueOnce({
        access_token: "access-token",
        refresh_token: "refresh-token",
        token_type: "bearer",
      })
      .mockResolvedValueOnce({
        id: "user-1",
        email: "test@example.com",
        is_active: true,
        created_at: new Date().toISOString(),
      });

    const request = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "test@example.com",
        password: "password123",
      }),
    });

    const response = await POST(request as never);
    const data = await response.json();

    expect(data.user.email).toBe("test@example.com");
    expect(data.message).toBe("Login successful");
    expect(response.cookies.get("access_token")?.value).toBe("access-token");
    expect(response.cookies.get("refresh_token")?.value).toBe("refresh-token");
    expect(backendFetch).toHaveBeenNthCalledWith(
      2,
      "/api/v1/auth/me",
      expect.objectContaining({
        headers: {
          Authorization: "Bearer access-token",
        },
      })
    );
  });
});
