/**
 * MrCA — Prisma Singleton with Connection Resilience
 * Phase 9: Retry logic, graceful shutdown, structured logging.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";

// We intentionally do NOT import from env.ts here to avoid circular imports
// and to keep prisma.ts usable in edge/middleware contexts where env.ts
// might throw before the adapter is ready.  DATABASE_URL is asserted below.
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: connectionString! });
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// ─── Connection Resilience ─────────────────────────────────────────────────

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Execute a Prisma operation with automatic retry on connection errors (P1001).
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  retries = MAX_RETRIES
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P1001"
      ) {
        logger.warn(`DB connection failed (attempt ${attempt}/${retries}), retrying…`, {
          code: err.code,
          attempt,
        });
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
          continue;
        }
      }
      throw err;
    }
  }
  throw lastError;
}

// ─── Graceful Shutdown ─────────────────────────────────────────────────────

async function disconnect() {
  try {
    await prisma.$disconnect();
    logger.info("Prisma disconnected cleanly");
  } catch (err) {
    logger.error("Error disconnecting Prisma", err);
  }
}

if (typeof process !== "undefined") {
  process.once("SIGTERM", disconnect);
  process.once("SIGINT", disconnect);
}
