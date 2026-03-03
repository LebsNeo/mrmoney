import { withAuth } from "next-auth/middleware";
import { NextRequest, NextResponse } from "next/server";
import { authRateLimit } from "@/lib/rate-limit";
import { verify } from "@/lib/finance-token";

// Routes that require finance PIN unlock
const FINANCE_ROUTES = [
  "/transactions",
  "/invoices",
  "/ota-payouts",
  "/ota",
  "/reports",
  "/payroll",
  "/budget",
  "/profitability",
  "/kpis",
  "/intelligence",
  "/forecast",
  "/import",
  "/digest",
  "/settings/ota-channels",
];

function isFinanceRoute(pathname: string): boolean {
  return FINANCE_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/") || pathname.startsWith(r + "?"));
}

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

    // ── Finance PIN gate ──
    if (isFinanceRoute(pathname)) {
      const token = req.cookies.get("finance_unlocked")?.value;
      const orgId = (req as any).nextauth?.token?.organisationId as string | undefined;

      if (orgId && token) {
        // Valid token → allow through
        if (verify(token, orgId)) return NextResponse.next();
      }

      // No valid token → check if org has a PIN set
      // We can't query DB in Edge middleware, so redirect to lock page
      // The lock page API will handle the "no PIN = auto-unlock" case
      const lockUrl = new URL("/finance-lock", req.url);
      lockUrl.searchParams.set("returnTo", pathname + req.nextUrl.search);
      return NextResponse.redirect(lockUrl);
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
    "/settings/:path*",
    "/finance-lock",
    "/api/auth/callback/credentials",
  ],
};
