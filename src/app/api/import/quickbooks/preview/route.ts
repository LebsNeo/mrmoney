import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseQuickBooksCSV } from "@/lib/quickbooks-import";
import { apiSuccess, apiError, apiUnauthorized, apiServerError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const orgId = (session?.user as { organisationId?: string })?.organisationId;
    if (!orgId) return apiUnauthorized();

    const firstProperty = await prisma.property.findFirst({
      where: { organisationId: orgId, isActive: true, deletedAt: null },
      select: { id: true },
    });

    if (!firstProperty) return apiError("No property found");

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) return apiError("Missing file");

    const csvContent = await file.text();
    const result = await parseQuickBooksCSV(csvContent, firstProperty.id, orgId);

    const serialise = (tx: (typeof result.transactions)[0]) => ({
      ...tx,
      date: tx.date.toISOString(),
    });

    return apiSuccess({
      transactions: result.transactions.map(serialise),
      potentialDuplicates: result.potentialDuplicates.map(serialise),
      unrecognised: result.unrecognised,
    });
  } catch (err) {
    logger.error("QuickBooks import preview error", err);
    return apiServerError();
  }
}
