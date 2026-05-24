import { NextRequest, NextResponse } from "next/server";
import {
  clearOpenTableCredentials,
  getAuthStatus,
} from "@/lib/credentials";
import {
  saveOpenTableSession,
  verifyOpenTableAuth,
} from "@/lib/platforms/opentable";

export async function GET() {
  const status = getAuthStatus();
  const otValid = status.opentable.connected
    ? await verifyOpenTableAuth()
    : false;
  return NextResponse.json({
    opentable: { ...status.opentable, valid: otValid },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      cookies: string;
      csrfToken?: string;
      email?: string;
    };

    if (!body.cookies?.trim()) {
      return NextResponse.json(
        { error: "Cookie string required" },
        { status: 400 }
      );
    }

    saveOpenTableSession(body.cookies.trim(), body.csrfToken, body.email);
    const valid = await verifyOpenTableAuth();

    return NextResponse.json({ ok: true, valid, email: body.email });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save session";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE() {
  clearOpenTableCredentials();
  return NextResponse.json({ ok: true });
}
