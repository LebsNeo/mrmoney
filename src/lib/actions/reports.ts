import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TransactionCategory } from "@prisma/client";
import { CHART_OF_ACCOUNTS, PLStatement, PLSection, PLLineItem } from "@/lib/coa";
import { logger } from "@/lib/logger";
import { PeriodPreset, resolvePeriod, formatPeriodLabel } from "@/lib/reports-utils";

export type { PeriodPreset };

async function getOrgId() {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as { organisationId?: string })?.organisationId;
  if (!orgId) throw new Error("Unauthorised");
  return orgId;
}

// ─────────────────────────────────────────────
// P&L GENERATOR
// ─────────────────────────────────────────────

export async function getPLStatement(
  preset: PeriodPreset,
  propertyId?: string,
  customFrom?: string,
  customTo?: string
): Promise<PLStatement> {
  "use server";
  const orgId = await getOrgId();
  const { from, to } = resolvePeriod(preset, customFrom, customTo);

  // Resolve property name
  const properties = await prisma.property.findMany({
    where: { organisationId: orgId, isActive: true, deletedAt: null },
    select: { id: true, name: true, currency: true },
  });

  const property = propertyId
    ? properties.find((p) => p.id === propertyId)
    : null;

  const propertyName = property?.name ?? "All Properties";
  const currency = property?.currency ?? "ZAR";

  // Fetch all transactions in period (non-deleted, non-void)
  const transactions = await prisma.transaction.findMany({
    where: {
      organisationId: orgId,
      ...(propertyId ? { propertyId } : {}),
      date: { gte: from, lte: to },
      deletedAt: null,
      status: { not: "VOID" },
      // Exclude VAT entries from the P&L (handled separately)
      category: { notIn: ["VAT_OUTPUT", "VAT_INPUT"] },
    },
    select: {
      type: true,
      category: true,
      amount: true,
    },
  });

  // Aggregate by category + type
  const totals = new Map<string, number>();
  for (const tx of transactions) {
    const key = `${tx.type}::${tx.category}`;
    totals.set(key, (totals.get(key) ?? 0) + Number(tx.amount));
  }

  function getAmount(category: TransactionCategory, type: "INCOME" | "EXPENSE"): number {
    return totals.get(`${type}::${category}`) ?? 0;
  }

  // ── Build sections ──────────────────────────

  function buildSection(
    group: "REVENUE" | "COST_OF_SALES" | "OPERATING_EXPENSES" | "FINANCIAL_CHARGES",
    type: "INCOME" | "EXPENSE"
  ): PLSection {
    const coaLines = CHART_OF_ACCOUNTS
      .filter((l) => l.group === group)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    // For OTHER: split by type (INCOME vs EXPENSE both map to OTHER)
    const lines: PLLineItem[] = [];
    for (const line of coaLines) {
      const amount = getAmount(line.category, type);
      if (amount > 0 || line.category !== "OTHER") {
        // Only include zero-amount lines for non-OTHER categories
        if (amount > 0 || line.category !== "OTHER") {
          lines.push({ category: line.category, label: line.label, amount });
        }
      }
    }

    // Filter out zero lines for cleanliness (keep at least 1 line per section)
    const nonZero = lines.filter((l) => l.amount > 0);
    const displayLines = nonZero.length > 0 ? nonZero : [];

    return {
      group,
      title: group === "REVENUE" ? "Revenue"
        : group === "COST_OF_SALES" ? "Cost of Sales"
        : group === "OPERATING_EXPENSES" ? "Operating Expenses"
        : "Financial Charges",
      lines: displayLines,
      total: displayLines.reduce((s, l) => s + l.amount, 0),
    };
  }

  const revenue           = buildSection("REVENUE", "INCOME");
  const costOfSales       = buildSection("COST_OF_SALES", "EXPENSE");
  const operatingExpenses = buildSection("OPERATING_EXPENSES", "EXPENSE");
  const financialCharges  = buildSection("FINANCIAL_CHARGES", "EXPENSE");

  // ── Key metrics ─────────────────────────────
  const totalRevenue   = revenue.total;
  const grossProfit    = totalRevenue - costOfSales.total;
  const ebitda         = grossProfit - operatingExpenses.total;
  const netProfit      = ebitda - financialCharges.total;
  const totalExpenses  = costOfSales.total + operatingExpenses.total + financialCharges.total;

  const pct = (n: number) => totalRevenue > 0 ? (n / totalRevenue) * 100 : 0;

  logger.info("P&L generated", { orgId, propertyName, from, to, totalRevenue, netProfit });

  return {
    propertyName,
    periodLabel: formatPeriodLabel(from, to),
    from,
    to,
    generatedAt: new Date(),
    currency,
    revenue,
    costOfSales,
    grossProfit,
    grossMargin: pct(grossProfit),
    operatingExpenses,
    ebitda,
    ebitdaMargin: pct(ebitda),
    financialCharges,
    netProfit,
    netMargin: pct(netProfit),
    totalRevenue,
    totalExpenses,
  };
}
