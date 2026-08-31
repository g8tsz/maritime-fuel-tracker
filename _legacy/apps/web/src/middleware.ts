import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-constants";
import { parseSessionEdge } from "@/lib/session-edge";
import { CORRELATION_HEADER } from "@/lib/correlation-constants";

export async function middleware(req: NextRequest) {
  const requestHeaders = new Headers(req.headers);
  if (!requestHeaders.has(CORRELATION_HEADER)) {
    requestHeaders.set(CORRELATION_HEADER, crypto.randomUUID());
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("reason", "misconfigured");
    return NextResponse.redirect(url);
  }
  const session = await parseSessionEdge(token, secret);
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set(CORRELATION_HEADER, requestHeaders.get(CORRELATION_HEADER)!);
  return res;
}

export const config = {
  matcher: ["/dashboard/:path*", "/sites/:path*", "/deliveries/:path*", "/invoices/:path*", "/admin/:path*"],
};
