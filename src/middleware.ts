import { withAuth } from "next-auth/middleware";
import { NextRequest, NextResponse } from "next/server";
import { authRateLimit } from "@/lib/rate-limit";

export default withAuth(
  async function middleware(req: NextRequest) {
    const pathname = req.nextUrl.pathname;

    // ── Rate limit auth routes ──
    if (pathname.startsWith("/api/auth/callback/credentials")) {
      const ip =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        req.headers.get("x-real-ip") ??
        "unknown";
      const result = authRateLimit(ip);
      if (!result.success) {
        return new NextResponse(
          JSON.stringify({ success: false, error: "Too many login attempts. Please wait 15 minutes and try again." }),
          { status: 429, headers: { "Content-Type": "application/json", "Retry-After": String(Math.ceil((result.resetAt - Date.now()) / 1000)) } }
        );
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/bookings/:path*",
    "/calendar/:path*",
    "/calendar",
    "/transactions/:path*",
    "/invoices/:path*",
    "/ota-payouts/:path*",
    "/ota/:path*",
    "/ota",
    "/reports/:path*",
    "/payroll/:path*",
    "/budget/:path*",
    "/profitability/:path*",
    "/kpis/:path*",
    "/intelligence/:path*",
    "/forecast/:path*",
    "/import/:path*",
    "/digest/:path*",
    "/properties/:path*",
    "/settings",
    "/settings/ota-channels",
    "/finance-lock",
    "/api/auth/callback/credentials",
  ],
};
