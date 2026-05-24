import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) return NextResponse.next();

  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const [scheme, encoded] = authHeader.split(" ");
    if (scheme === "Basic" && encoded) {
      const decoded = atob(encoded);
      const [, password] = decoded.split(":");
      if (password === appPassword) {
        return NextResponse.next();
      }
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Reservation Bot"',
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
