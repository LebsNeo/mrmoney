import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseQuickBooksCSV } from "@/lib/quickbooks-import";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as { organisationId?: string })?.organisationId;
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const firstProperty = await prisma.property.findFirst({
    where: { organisationId: orgId, isActive: true, deletedAt: null },
    select: { id: true },
  });

  if (!firstProperty) {
    return NextResponse.json({ error: "No property found" }, { status: 400 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File;

  if (!file) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const csvContent = await file.text();
  const result = await parseQuickBooksCSV(csvContent, firstProperty.id, orgId);

  const serialise = (tx: (typeof result.transactions)[0]) => ({
    ...tx,
    date: tx.date.toISOString(),
  });

  return NextResponse.json({
    transactions: result.transactions.map(serialise),
    potentialDuplicates: result.potentialDuplicates.map(serialise),
    unrecognised: result.unrecognised,
  });
}
