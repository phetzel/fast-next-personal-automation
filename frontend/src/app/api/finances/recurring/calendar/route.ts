import { NextRequest, NextResponse } from "next/server";
import { BackendApiError, backendErrorResponse, backendFetch } from "@/lib/server-api";

function auth(request: NextRequest) {
  return request.cookies.get("access_token")?.value;
}

export async function GET(request: NextRequest) {
  try {
    const token = auth(request);
    if (!token) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    const qs = request.nextUrl.searchParams.toString();
    const data = await backendFetch(`/api/v1/finances/recurring/calendar${qs ? `?${qs}` : ""}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof BackendApiError) return backendErrorResponse(error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
