"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TransactionCategory, TransactionType } from "@prisma/client";
import { resolveGroup, resolveLabel, COAGroup, GROUP_META } from "@/lib/coa";
import { logger } from "@/lib/logger";

async function getOrgId() {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as { organisationId?: string })?.organisationId;
  if (!orgId) throw new Error("Unauthorised");
  return orgId;
}

export interface PLLineItem {
  category: TransactionCategory;
  label: string;
  amount: number;       // always positive
  txCount: number;
}

export interface PLGroup {
  group: COAGroup;
  label: string;
  lines: PLLineItem[];
  total: number;        // always positive
}

export interface PLStatement {
  orgId: string;
  propertyId: string | null;
  propertyName: string;
  periodLabel: string;
  dateFrom: string;
  dateTo: string;
  groups: PLGroup[];
  // Computed subtotals
  totalRevenue: number;
  totalCOGS: number;
  grossProfit: number;
  grossMargin: number;       // %
  totalOpEx: number;
  ebitda: number;
  ebitdaMargin: number;      // %
  totalFinancial: number;
  netProfit: number;
  netMargin: number;         // %
  // Basis
  basis: "cash";
  generatedAt: string;
}

export async function getPLStatement(
  dateFrom: string,
  dateTo: string,
  propertyId?: string
): Promise<PLStatement> {
  const orgId = await getOrgId();

  // Resolve property
  const properties = await prisma.property.findMany({
    where: { organisationId: orgId, deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const selectedProp = propertyId
    ? properties.find((p) => p.id === propertyId)
    : null;

  const propertyName = selectedProp?.name ?? "All Properties";

  // Fetch cleared/reconciled transactions in range
  const txns = await prisma.transaction.findMany({
    where: {
      organisationId: orgId,
      ...(propertyId ? { propertyId } : {}),
      date: {
        gte: new Date(dateFrom),
        lte: new Date(dateTo),
      },
      status: { in: ["CLEARED", "RECONCILED"] },
      deletedAt: null,
    },
    select: {
      category: true,
      type: true,
      amount: true,
    },
  });

  // Aggregate by category + type
  const aggMap = new Map<string, { category: TransactionCategory; type: TransactionType; amount: number; count: number }>();

  for (const tx of txns) {
    const key = `${tx.category}::${tx.type}`;
    const existing = aggMap.get(key);
    const amt = Number(tx.amount);
    if (existing) {
      existing.amount += amt;
      existing.count++;
    } else {
      aggMap.set(key, { category: tx.category, type: tx.type, amount: amt, count: 1 });
    }
  }

  // Build group → lines map
  const groupMap = new Map<COAGroup, PLLineItem[]>();
  for (const [, agg] of aggMap) {
    const group = resolveGroup(agg.category, agg.type);
    const label = resolveLabel(agg.category, agg.type);
    if (!groupMap.has(group)) groupMap.set(group, []);
    groupMap.get(group)!.push({
      category: agg.category,
      label,
      amount: agg.amount,
      txCount: agg.count,
    });
  }

  // Build ordered groups
  const ORDER: COAGroup[] = ["REVENUE", "COST_OF_SALES", "OPERATING_EXPENSES", "FINANCIAL_CHARGES"];
  const groups: PLGroup[] = ORDER.map((g) => {
    const lines = (groupMap.get(g) ?? []).sort((a, b) => b.amount - a.amount);
    const total = lines.reduce((s, l) => s + l.amount, 0);
    return { group: g, label: GROUP_META[g].label, lines, total };
  });

  // Subtotals
  const totalRevenue   = groups.find((g) => g.group === "REVENUE")?.total ?? 0;
  const totalCOGS      = groups.find((g) => g.group === "COST_OF_SALES")?.total ?? 0;
  const grossProfit    = totalRevenue - totalCOGS;
  const grossMargin    = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
  const totalOpEx      = groups.find((g) => g.group === "OPERATING_EXPENSES")?.total ?? 0;
  const ebitda         = grossProfit - totalOpEx;
  const ebitdaMargin   = totalRevenue > 0 ? (ebitda / totalRevenue) * 100 : 0;
  const totalFinancial = groups.find((g) => g.group === "FINANCIAL_CHARGES")?.total ?? 0;
  const netProfit      = ebitda - totalFinancial;
  const netMargin      = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  // Period label
  const from = new Date(dateFrom);
  const to = new Date(dateTo);
  const periodLabel = from.toLocaleDateString("en-ZA", { month: "long", year: "numeric" }) ===
    to.toLocaleDateString("en-ZA", { month: "long", year: "numeric" })
    ? from.toLocaleDateString("en-ZA", { month: "long", year: "numeric" })
    : `${from.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })} – ${to.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}`;

  logger.info("P&L generated", { orgId, propertyId, dateFrom, dateTo, netProfit });

  return {
    orgId,
    propertyId: propertyId ?? null,
    propertyName,
    periodLabel,
    dateFrom,
    dateTo,
    groups,
    totalRevenue,
    totalCOGS,
    grossProfit,
    grossMargin,
    totalOpEx,
    ebitda,
    ebitdaMargin,
    totalFinancial,
    netProfit,
    netMargin,
    basis: "cash",
    generatedAt: new Date().toISOString(),
  };
}
