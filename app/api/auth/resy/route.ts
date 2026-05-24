import { NextRequest, NextResponse } from "next/server";
import { getAuthStatus, setResyCredentials } from "@/lib/credentials";
import { loginResy, verifyResyAuth } from "@/lib/platforms/resy";

export async function GET() {
  const status = getAuthStatus();
  const resyValid = status.resy.connected ? await verifyResyAuth() : false;
  return NextResponse.json({
    ...status,
    resy: { ...status.resy, valid: resyValid },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      email: string;
      password: string;
      apiKey?: string;
    };

    if (!body.email || !body.password) {
      return NextResponse.json(
        { error: "Email and password required" },
        { status: 400 }
      );
    }

    const result = await loginResy(body.email, body.password, body.apiKey);
    setResyCredentials({
      apiKey: result.apiKey,
      authToken: result.authToken,
      email: body.email,
    });

    return NextResponse.json({ ok: true, email: body.email });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Login failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE() {
  const { clearResyCredentials } = await import("@/lib/credentials");
  clearResyCredentials();
  return NextResponse.json({ ok: true });
}
