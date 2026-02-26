import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBankStatementCSV } from "@/lib/bank-import";
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
    const bankFormat = formData.get("bankFormat") as string;
    const file = formData.get("file") as File;

    if (!bankFormat || !file) return apiError("Missing required fields");

    const csvContent = await file.text();
    // skipDuplicateCheck=true: no per-row DB calls — preview is instant
    const result = await parseBankStatementCSV(
      csvContent,
      bankFormat,
      firstProperty.id,
      orgId,
      true
    );

    // Serialize dates for JSON transport
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
    logger.error("Bank import preview error", err);
    return apiServerError();
  }
}
