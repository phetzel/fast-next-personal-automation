import { NextRequest, NextResponse } from "next/server";
import { setAuthCookies } from "@/lib/auth-cookies";
import { backendErrorMessage, backendFetch, BackendApiError } from "@/lib/server-api";
import type { AuthTokenResponse, User } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Backend expects OAuth2 form data format
    const formData = new URLSearchParams();
    formData.append("username", body.email);
    formData.append("password", body.password);

    const tokens = await backendFetch<AuthTokenResponse>("/api/v1/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const user = await backendFetch<User>("/api/v1/auth/me", {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    const response = NextResponse.json({
      user,
      message: "Login successful",
    });

    setAuthCookies(response.cookies, tokens);

    return response;
  } catch (error) {
    if (error instanceof BackendApiError) {
      const detail = backendErrorMessage(error, "Login failed");
      return NextResponse.json({ detail }, { status: error.status });
    }
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
