import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import OTAImportForm from "@/components/OTAImportForm";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

async function getData(orgId: string) {
  const properties = await prisma.property.findMany({
    where: { organisationId: orgId, isActive: true, deletedAt: null },
    select: { id: true, name: true, organisationId: true },
    orderBy: { name: "asc" },
  });
  return { properties, organisationId: orgId };
}

export default async function OTAImportPage() {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as any)?.organisationId as string ?? "";
  const { properties, organisationId } = await getData(orgId);

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center gap-2 text-sm text-gray-400">
        <Link href="/ota-payouts" className="hover:text-white transition-colors">
          OTA Payouts
        </Link>
        <span>/</span>
        <span className="text-white">Import CSV</span>
      </div>

      <PageHeader
        title="Import OTA Payout"
        description="Upload a payout CSV from Airbnb or Booking.com"
      />

      {properties.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
          <p className="text-gray-400 mb-4">
            No properties found. Please create a property first.
          </p>
          <Link
            href="/properties"
            className="px-4 py-2 rounded-xl text-sm font-medium bg-emerald-500 text-white hover:bg-emerald-600"
          >
            Go to Properties
          </Link>
        </div>
      ) : (
        <OTAImportForm properties={properties} organisationId={organisationId} />
      )}
    </div>
  );
}
