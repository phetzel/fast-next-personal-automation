import { NextRequest, NextResponse } from "next/server";
import { backendErrorResponse, backendFetch, BackendApiError } from "@/lib/server-api";
import type { User } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const accessToken = request.cookies.get("access_token")?.value;

    if (!accessToken) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const data = await backendFetch<User>("/api/v1/auth/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof BackendApiError) {
      return backendErrorResponse(error);
    }
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
