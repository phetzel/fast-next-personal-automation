import { NextRequest, NextResponse } from "next/server";
import { backendFetch, BackendApiError } from "@/lib/server-api";
import type { PipelineRunListResponse } from "@/types";

/**
 * GET /api/pipelines/runs - List pipeline runs with filtering.
 */
export async function GET(request: NextRequest) {
  try {
    const accessToken = request.cookies.get("access_token")?.value;

    if (!accessToken) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    // Forward all query params to backend
    const searchParams = request.nextUrl.searchParams.toString();
    const url = `/api/v1/pipelines/runs${searchParams ? `?${searchParams}` : ""}`;

    const data = await backendFetch<PipelineRunListResponse>(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof BackendApiError) {
      return NextResponse.json(
        { detail: error.message || "Failed to fetch pipeline runs" },
        { status: error.status }
      );
    }
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}

