import { NextRequest, NextResponse } from "next/server";
import { BackendApiError, backendFetch } from "@/lib/server-api";

function auth(request: NextRequest) {
  return request.cookies.get("access_token")?.value;
}

export async function GET(request: NextRequest) {
  try {
    const token = auth(request);
    if (!token) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    const data = await backendFetch("/api/v1/finances/accounts", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof BackendApiError)
      return NextResponse.json({ detail: error.message }, { status: error.status });
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = auth(request);
    if (!token) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    const body = await request.json();
    const data = await backendFetch("/api/v1/finances/accounts", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    if (error instanceof BackendApiError)
      return NextResponse.json({ detail: error.message }, { status: error.status });
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
