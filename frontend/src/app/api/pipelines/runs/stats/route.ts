import { NextRequest, NextResponse } from "next/server";
import { backendFetch, BackendApiError } from "@/lib/server-api";
import type { PipelineRunStats } from "@/types";

/**
 * GET /api/pipelines/runs/stats - Get pipeline run statistics.
 */
export async function GET(request: NextRequest) {
  try {
    const accessToken = request.cookies.get("access_token")?.value;

    if (!accessToken) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    // Forward query params
    const searchParams = request.nextUrl.searchParams.toString();
    const url = `/api/v1/pipelines/runs/stats${searchParams ? `?${searchParams}` : ""}`;

    const data = await backendFetch<PipelineRunStats>(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof BackendApiError) {
      return NextResponse.json(
        { detail: error.message || "Failed to fetch pipeline stats" },
        { status: error.status }
      );
    }
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}


