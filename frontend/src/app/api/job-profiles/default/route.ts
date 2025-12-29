import { NextRequest, NextResponse } from "next/server";
import { backendFetch, BackendApiError } from "@/lib/server-api";

/**
 * GET /api/job-profiles/default - Get the default job search profile
 */
export async function GET(request: NextRequest) {
  try {
    const accessToken = request.cookies.get("access_token")?.value;

    if (!accessToken) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const data = await backendFetch("/api/v1/job-profiles/default", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof BackendApiError) {
      // 404 means no default profile yet, return null
      if (error.status === 404) {
        return NextResponse.json(null);
      }
      return NextResponse.json(
        { detail: error.message || "Failed to fetch default profile" },
        { status: error.status }
      );
    }
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}



