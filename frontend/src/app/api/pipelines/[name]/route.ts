import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { backendFetch, BackendApiError } from "@/lib/server-api";
import type { PipelineInfo } from "@/types";

interface RouteParams {
  params: Promise<{ name: string }>;
}

/**
 * GET /api/pipelines/[name] - Get pipeline details.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { name } = await params;
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("access_token")?.value;

    const data = await backendFetch<PipelineInfo>(`/api/v1/pipelines/${name}`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    });

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof BackendApiError) {
      return NextResponse.json(
        { detail: error.data || "Pipeline not found" },
        { status: error.status }
      );
    }
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}



