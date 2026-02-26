import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { BudgetEditForm } from "@/components/BudgetEditForm";
import {
  getAvailablePeriods,
  getPreviousPeriod,
  getBudgetItems,
} from "@/lib/actions/budget";
import { TransactionCategory } from "@prisma/client";
import { currentPeriod } from "@/lib/utils";
import Link from "next/link";

// All expense-related categories
const ALL_EXPENSE_CATEGORIES: TransactionCategory[] = [
  TransactionCategory.CLEANING,
  TransactionCategory.FB,
  TransactionCategory.LAUNDRY,
  TransactionCategory.MAINTENANCE,
  TransactionCategory.MARKETING,
  TransactionCategory.OTA_COMMISSION,
  TransactionCategory.SALARIES,
  TransactionCategory.SUPPLIES,
  TransactionCategory.UTILITIES,
  TransactionCategory.OTHER,
];

interface PageProps {
  searchParams: Promise<{ period?: string; propertyId?: string }>;
}

export default async function BudgetEditPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const orgId = (session.user as any).organisationId as string;
  const params = await searchParams;

  const period = params.period ?? currentPeriod();
  const previousPeriod = await getPreviousPeriod(period);
  const availablePeriods = await getAvailablePeriods();

  // Get all active properties
  const properties = await prisma.property.findMany({
    where: { organisationId: orgId, isActive: true, deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  if (properties.length === 0) {
    return (
      <div>
        <PageHeader title="Edit Budget" description="No properties found." />
      </div>
    );
  }

  const selectedPropertyId = params.propertyId ?? properties[0].id;
  const selectedProperty = properties.find((p) => p.id === selectedPropertyId) ?? properties[0];

  // Existing budget items for this property + period
  const existingItems = await getBudgetItems(selectedProperty.id, period);
  const initialItems = existingItems.map((item) => ({
    category: item.category,
    budgetedAmount: parseFloat(item.budgetedAmount.toString()),
  }));

  return (
    <div>
      <PageHeader
        title="Edit Budget"
        description={`Set monthly budget targets for ${selectedProperty.name}`}
      />

      {/* Back link */}
      <div className="mb-6">
        <Link
          href="/budget"
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          ← Back to Budget Overview
        </Link>
      </div>

      {/* Property Selector (if multiple) */}
      {properties.length > 1 && (
        <div className="mb-6">
          <label className="block text-xs text-gray-500 mb-1.5">Property</label>
          <div className="flex gap-2 flex-wrap">
            {properties.map((p) => (
              <Link
                key={p.id}
                href={`/budget/edit?period=${period}&propertyId=${p.id}`}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  p.id === selectedProperty.id
                    ? "bg-emerald-500 text-white"
                    : "bg-gray-800 border border-gray-700 text-gray-400 hover:text-white"
                }`}
              >
                {p.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      <BudgetEditForm
        propertyId={selectedProperty.id}
        period={period}
        previousPeriod={previousPeriod}
        initialItems={initialItems}
        allCategories={ALL_EXPENSE_CATEGORIES}
        availablePeriods={availablePeriods}
      />
    </div>
  );
}
