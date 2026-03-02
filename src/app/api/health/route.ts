/**
 * MrCA — Health Check Endpoint
 * Phase 9: GET /api/health
 * Used by Vercel and monitoring tools to verify deployment health.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const timestamp = new Date().toISOString();
  const version = process.env.npm_package_version ?? "0.1.0";

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { status: "ok", db: "connected", version, timestamp },
      { status: 200 }
    );
  } catch (err) {
    logger.error("Health check DB connection failed", err);
    return NextResponse.json(
      { status: "degraded", db: "error", version, timestamp },
      { status: 503 }
    );
  }
}
