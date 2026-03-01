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

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const propertyIdParam = (formData.get("propertyId") as string | null) ?? "";

    if (!file) return apiError("Missing file");

    // Use provided propertyId or fall back to first active property
    let property: { id: string } | null = null;
    if (propertyIdParam) {
      property = await prisma.property.findFirst({
        where: { id: propertyIdParam, organisationId: orgId, deletedAt: null },
        select: { id: true },
      });
    }
    if (!property) {
      property = await prisma.property.findFirst({
        where: { organisationId: orgId, isActive: true, deletedAt: null },
        select: { id: true },
      });
    }
    if (!property) return apiError("No property found");

    const csvContent = await file.text();
    const result = await parseQuickBooksCSV(csvContent, property.id, orgId);

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
