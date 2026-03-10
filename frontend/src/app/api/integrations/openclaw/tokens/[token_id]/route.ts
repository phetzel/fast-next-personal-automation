import { NextRequest, NextResponse } from "next/server";
import { backendErrorResponse, BackendApiError, backendFetch } from "@/lib/server-api";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ token_id: string }> }
) {
  try {
    const accessToken = request.cookies.get("access_token")?.value;
    const { token_id: tokenId } = await params;

    if (!accessToken) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    await backendFetch(`/api/v1/integrations/openclaw/tokens/${tokenId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof BackendApiError) {
      return backendErrorResponse(error);
    }
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
