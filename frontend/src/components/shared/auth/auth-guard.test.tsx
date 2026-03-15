import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthGuard } from "./auth-guard";
import { useAuthStore } from "@/stores";
import { apiClient } from "@/lib/api-client";

vi.mock("@/lib/api-client", () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

describe("AuthGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: true,
    });
  });

  it("bootstraps auth state from /auth/me before rendering children", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      id: "user-1",
      email: "test@example.com",
      is_active: true,
      created_at: new Date().toISOString(),
    });

    render(
      <AuthGuard>
        <div>Protected content</div>
      </AuthGuard>
    );

    expect(screen.getByText("Loading...")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Protected content")).toBeInTheDocument();
    });

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().user?.email).toBe("test@example.com");
  });

  it("hides protected content when bootstrap fails", async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error("Not authenticated"));

    render(
      <AuthGuard>
        <div>Protected content</div>
      </AuthGuard>
    );

    await waitFor(() => {
      expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
    });

    expect(screen.getByText("You are not signed in.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to login" })).toHaveAttribute("href", "/login");
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
