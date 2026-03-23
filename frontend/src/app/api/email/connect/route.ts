import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  backendErrorMessage,
  BackendApiError,
  backendFetch,
} from "@/lib/server-api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface GmailConnectTokenResponse {
  connect_token: string;
}

/**
 * Initiates Gmail OAuth connection with a short-lived connect token.
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("access_token")?.value;

    if (!accessToken) {
      return NextResponse.json(
        { error: "Not authenticated. Please log in first." },
        { status: 401 }
      );
    }

    const data = await backendFetch<GmailConnectTokenResponse>(
      "/api/v1/email/gmail/connect-token",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const connectUrl = `${API_URL}/api/v1/email/gmail/connect?connect_token=${encodeURIComponent(
      data.connect_token
    )}`;

    return NextResponse.json({ url: connectUrl });
  } catch (error) {
    if (error instanceof BackendApiError) {
      return NextResponse.json(
        { error: backendErrorMessage(error, "Failed to initiate connection") },
        { status: error.status }
      );
    }

    console.error("Error initiating Gmail connection:", error);
    return NextResponse.json({ error: "Failed to initiate connection" }, { status: 500 });
  }
}
