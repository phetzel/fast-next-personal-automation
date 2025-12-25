import { NextRequest, NextResponse } from "next/server";
import { backendFetch, BackendApiError } from "@/lib/server-api";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/jobs/[id]/cover-letter/generate-pdf
 * Generate a PDF from the job's cover letter and store it in S3.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const accessToken = request.cookies.get("access_token")?.value;

    if (!accessToken) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;

    const data = await backendFetch(`/api/v1/jobs/${id}/cover-letter/generate-pdf`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof BackendApiError) {
      return NextResponse.json(
        { detail: error.message || "Failed to generate PDF" },
        { status: error.status }
      );
    }
    console.error("Cover letter PDF generation error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
