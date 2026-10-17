import { NextResponse, type NextRequest } from "next/server";

const COOKIE = process.env.SESSION_COOKIE_NAME ?? "commons_session";

// Fast path only: no cookie → /login. Pages still check the session itself (lib/auth.ts).
export function proxy(request: NextRequest) {
  if (!request.cookies.has(COOKIE)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  // Not for /login, the MCP endpoint (bearer tokens), Next internals or files with an extension.
  matcher: ["/((?!login|api/|_next/|.*\\..*).*)"],
};
