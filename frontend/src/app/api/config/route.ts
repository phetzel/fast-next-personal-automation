import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/server-api";

export async function GET() {
  try {
    const data = await backendFetch("/api/v1/config/public");
    return NextResponse.json(data);
  } catch {
    // Return defaults if backend is unavailable
    return NextResponse.json({
      registration_enabled: false,
    });
  }
}
