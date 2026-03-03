"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { TransactionCategory } from "@prisma/client";

async function getOrgId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return (session?.user as { organisationId?: string })?.organisationId ?? null;
}

export interface CatRule {
  id: string;
  keyword: string;
  category: TransactionCategory;
  confidence: string;
  source: string;
  hitCount: number;
  createdAt: Date;
}

export async function getCategorisationRules(): Promise<CatRule[]> {
  const orgId = await getOrgId();
  if (!orgId) return [];

  try {
    const rows = await prisma.$queryRaw<Array<{
      id: string;
      keyword: string;
      category: string;
      confidence: string;
      source: string;
      hit_count: number;
      created_at: Date;
    }>>`
      SELECT id, keyword, category, confidence, source, hit_count, created_at
      FROM categorisation_rules
      WHERE organisation_id = ${orgId}
      ORDER BY source ASC, created_at DESC
    `;

    return rows.map((r) => ({
      id: r.id,
      keyword: r.keyword,
      category: r.category as TransactionCategory,
      confidence: r.confidence,
      source: r.source,
      hitCount: r.hit_count,
      createdAt: r.created_at,
    }));
  } catch {
    return [];
  }
}

export async function upsertCategorisationRule(
  keyword: string,
  category: TransactionCategory
): Promise<{ ok: boolean; error?: string }> {
  try {
    const orgId = await getOrgId();
    if (!orgId) return { ok: false, error: "Unauthorized" };

    const kw = keyword.trim().toLowerCase();
    if (kw.length < 2) return { ok: false, error: "Keyword must be at least 2 characters" };

    await prisma.$executeRaw`
      INSERT INTO categorisation_rules (id, organisation_id, keyword, category, confidence, source, hit_count, created_at, updated_at)
      VALUES (gen_random_uuid(), ${orgId}, ${kw}, ${category}, 'HIGH', 'manual', 1, now(), now())
      ON CONFLICT (organisation_id, keyword)
      DO UPDATE SET category = EXCLUDED.category, confidence = 'HIGH', source = 'manual', updated_at = now()
    `;

    revalidatePath("/transactions");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to save rule" };
  }
}

export async function deleteCategorisationRule(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const orgId = await getOrgId();
    if (!orgId) return { ok: false, error: "Unauthorized" };

    await prisma.$executeRaw`
      DELETE FROM categorisation_rules WHERE id = ${id}::uuid AND organisation_id = ${orgId}
    `;

    revalidatePath("/transactions");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to delete rule" };
  }
}

export async function applyRuleToExistingTransactions(
  keyword: string,
  category: TransactionCategory
): Promise<{ ok: boolean; updated?: number; error?: string }> {
  try {
    const orgId = await getOrgId();
    if (!orgId) return { ok: false, error: "Unauthorized" };

    // Find all transactions for this org matching the keyword
    const matches = await prisma.transaction.findMany({
      where: {
        organisationId: orgId,
        deletedAt: null,
        description: { contains: keyword, mode: "insensitive" },
      },
      select: { id: true },
    });

    if (matches.length > 0) {
      await prisma.transaction.updateMany({
        where: { id: { in: matches.map((m) => m.id) } },
        data: { category },
      });
    }

    revalidatePath("/transactions");
    revalidatePath("/reports/pl");
    return { ok: true, updated: matches.length };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to apply rule" };
  }
}
