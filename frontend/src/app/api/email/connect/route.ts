import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Initiates Gmail OAuth connection.
 * Gets the auth token and passes it to the backend.
 */
export async function GET() {
  try {
    // Get the access token from cookies
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("access_token")?.value;

    if (!accessToken) {
      return NextResponse.json(
        { error: "Not authenticated. Please log in first." },
        { status: 401 }
      );
    }

    // Return the OAuth URL with the token as a query param
    // The backend will validate this token and start the OAuth flow
    const connectUrl = `${API_URL}/api/v1/email/gmail/connect?token=${encodeURIComponent(accessToken)}`;

    return NextResponse.json({ url: connectUrl });
  } catch (error) {
    console.error("Error initiating Gmail connection:", error);
    return NextResponse.json({ error: "Failed to initiate connection" }, { status: 500 });
  }
}
