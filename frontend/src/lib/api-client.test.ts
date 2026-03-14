import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "./api-client";
import { handleAuthFailure } from "@/lib/auth-failure";

vi.mock("@/lib/auth-failure", () => ({
  handleAuthFailure: vi.fn(),
}));

describe("apiClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("retries once after refreshing an expired session", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: "Token expired" }), { status: 401 })
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "Token refreshed" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));

    const data = await apiClient.get<{ ok: boolean }>("/jobs");

    expect(data).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/auth/refresh", { method: "POST" });
  });

  it("does not retry excluded auth endpoints", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: "Login failed" }), { status: 401 })
      );

    await expect(
      apiClient.post("/auth/login", { email: "test@example.com", password: "bad-password" })
    ).rejects.toMatchObject({
      status: 401,
      message: "Login failed",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(handleAuthFailure).not.toHaveBeenCalled();
  });

  it("clears auth state and redirects when refresh fails", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: "Token expired" }), { status: 401 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: "Session expired" }), { status: 401 })
      );

    await expect(apiClient.get("/jobs")).rejects.toMatchObject({
      status: 401,
    });

    expect(handleAuthFailure).toHaveBeenCalledTimes(1);
  });
});
