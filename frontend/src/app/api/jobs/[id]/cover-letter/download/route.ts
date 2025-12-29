import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/jobs/[id]/cover-letter/download
 * Download the generated cover letter PDF.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const accessToken = request.cookies.get("access_token")?.value;

    if (!accessToken) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";

    const response = await fetch(
      `${backendUrl}/api/v1/jobs/${id}/cover-letter/download`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Download failed" }));
      return NextResponse.json(
        { detail: error.detail || "Download failed" },
        { status: response.status }
      );
    }

    // Get the PDF bytes and forward them
    const pdfBuffer = await response.arrayBuffer();
    const contentDisposition = response.headers.get("Content-Disposition");
    const filename = contentDisposition?.match(/filename="(.+)"/)?.[1] || "cover-letter.pdf";

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdfBuffer.byteLength),
      },
    });
  } catch (error) {
    console.error("Cover letter download error:", error);
    return NextResponse.json(
      { detail: "Failed to download cover letter" },
      { status: 500 }
    );
  }
}
