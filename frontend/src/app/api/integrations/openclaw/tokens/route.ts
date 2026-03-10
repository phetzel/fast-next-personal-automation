import { NextRequest, NextResponse } from "next/server";
import { backendErrorResponse, BackendApiError, backendFetch } from "@/lib/server-api";

function getAccessToken(request: NextRequest): string | null {
  return request.cookies.get("access_token")?.value ?? null;
}

export async function GET(request: NextRequest) {
  try {
    const accessToken = getAccessToken(request);

    if (!accessToken) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const data = await backendFetch("/api/v1/integrations/openclaw/tokens", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof BackendApiError) {
      return backendErrorResponse(error);
    }
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const accessToken = getAccessToken(request);

    if (!accessToken) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();

    const data = await backendFetch("/api/v1/integrations/openclaw/tokens", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    if (error instanceof BackendApiError) {
      return backendErrorResponse(error);
    }
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
