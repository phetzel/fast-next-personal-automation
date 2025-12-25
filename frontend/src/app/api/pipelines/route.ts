import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { backendFetch, BackendApiError } from "@/lib/server-api";
import type { PipelineListResponse } from "@/types";

/**
 * GET /api/pipelines - List all available pipelines.
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("access_token")?.value;

    const data = await backendFetch<PipelineListResponse>("/api/v1/pipelines", {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    });

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof BackendApiError) {
      return NextResponse.json(
        { detail: error.data || "Failed to fetch pipelines" },
        { status: error.status }
      );
    }
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}



