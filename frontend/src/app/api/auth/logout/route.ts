import { NextRequest, NextResponse } from "next/server";
import { clearAuthCookies } from "@/lib/auth-cookies";
import { backendFetch } from "@/lib/server-api";

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get("refresh_token")?.value;

  if (refreshToken) {
    try {
      await backendFetch("/api/v1/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    } catch {
      // Clear local cookies even if the backend session is already gone.
    }
  }

  const response = NextResponse.json({ message: "Logged out successfully" });
  clearAuthCookies(response.cookies);

  return response;
}
