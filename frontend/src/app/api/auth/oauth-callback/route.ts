import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { setAuthCookies } from "@/lib/auth-cookies";

export async function POST(request: NextRequest) {
  try {
    const { accessToken, refreshToken } = await request.json();

    if (!accessToken || !refreshToken) {
      return NextResponse.json({ error: "Missing tokens" }, { status: 400 });
    }

    const cookieStore = await cookies();
    setAuthCookies(cookieStore, {
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to process OAuth callback" }, { status: 500 });
  }
}
