import { NextRequest, NextResponse } from "next/server";

/**
 * Get the access token for WebSocket authentication.
 *
 * WebSocket connections can't use HTTP-only cookies, so this endpoint
 * allows the frontend to get the token to pass as a query parameter.
 */
export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get("access_token")?.value;

  if (!accessToken) {
    return NextResponse.json({ token: null }, { status: 200 });
  }

  return NextResponse.json({ token: accessToken });
}
