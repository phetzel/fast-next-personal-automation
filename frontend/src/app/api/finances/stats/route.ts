import { NextRequest, NextResponse } from "next/server";
import { BackendApiError, backendErrorResponse, backendFetch } from "@/lib/server-api";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("access_token")?.value;
    if (!token) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    const data = await backendFetch("/api/v1/finances/stats", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof BackendApiError) return backendErrorResponse(error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
