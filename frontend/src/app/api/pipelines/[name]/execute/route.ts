import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { backendFetch, BackendApiError } from "@/lib/server-api";
import type { PipelineExecuteResponse } from "@/types";

interface RouteParams {
  params: Promise<{ name: string }>;
}

/**
 * POST /api/pipelines/[name]/execute - Execute a pipeline.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { name } = await params;
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("access_token")?.value;

    if (!accessToken) {
      return NextResponse.json({ detail: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();

    const data = await backendFetch<PipelineExecuteResponse>(
      `/api/v1/pipelines/${name}/execute`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ input: body }),
      }
    );

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof BackendApiError) {
      return NextResponse.json(
        { detail: error.data || "Pipeline execution failed" },
        { status: error.status }
      );
    }
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}

