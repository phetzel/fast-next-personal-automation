import { NextRequest, NextResponse } from "next/server";
import { BackendApiError, backendErrorResponse, backendFetch } from "@/lib/server-api";

function auth(request: NextRequest) {
  return request.cookies.get("access_token")?.value;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = auth(request);
    if (!token) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    const { id } = await params;
    const body = await request.json();
    const data = await backendFetch(`/api/v1/finances/categories/${id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof BackendApiError) return backendErrorResponse(error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = auth(request);
    if (!token) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    const { id } = await params;
    await backendFetch(`/api/v1/finances/categories/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof BackendApiError) return backendErrorResponse(error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
