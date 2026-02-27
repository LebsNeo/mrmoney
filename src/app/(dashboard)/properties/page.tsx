import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { PropertyRoomsCard } from "@/components/PropertyRoomsCard";
import { PropertyBillingForm } from "@/components/PropertyBillingForm";
import { AddPropertyButton } from "@/components/AddPropertyButton";
import { PropertyEditButton } from "@/components/PropertyEditButton";
import { formatCurrency } from "@/lib/utils";

export default async function PropertiesPage() {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as any)?.organisationId as string | undefined;

  const properties = orgId
    ? await prisma.property.findMany({
        where: { organisationId: orgId, deletedAt: null },
        include: {
          rooms: {
            where: { deletedAt: null },
            orderBy: { name: "asc" },
          },
          _count: {
            select: { rooms: { where: { deletedAt: null } } },
          },
        },
        orderBy: { name: "asc" },
      })
    : [];

  return (
    <div>
      <PageHeader
        title="Properties"
        description={`${properties.length} propert${properties.length !== 1 ? "ies" : "y"}`}
        action={<AddPropertyButton />}
      />

      {properties.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl">
          <EmptyState
            icon="🏠"
            title="No properties yet"
            message="Add your first property to get started."
          />
        </div>
      ) : (
        <div className="space-y-4">
          {properties.map((property) => {
            const activeRooms = property.rooms.filter((r) => r.status === "ACTIVE");
            const avgRate =
              property.rooms.length > 0
                ? property.rooms.reduce((sum, r) => sum + Number(r.baseRate), 0) /
                  property.rooms.length
                : 0;

            return (
              <div
                key={property.id}
                className="bg-gray-900 border border-gray-800 rounded-2xl p-6"
              >
                {/* Property header */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-white font-semibold text-lg">{property.name}</h2>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          property.isActive
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-gray-700 text-gray-500"
                        }`}
                      >
                        {property.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    {(property.address || property.city) && (
                      <p className="text-sm text-gray-400 mt-1">
                        {[property.address, property.city].filter(Boolean).join(", ")}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-0.5">
                      {property.type.replace(/_/g, " ")}
                    </p>
                  </div>

                  {/* Stats + Edit button */}
                  <div className="flex items-start gap-4 sm:gap-6 shrink-0">
                    <div className="flex gap-4 sm:gap-6">
                      <div className="text-center">
                        <p className="text-lg font-bold text-white">{property._count.rooms}</p>
                        <p className="text-xs text-gray-500">Rooms</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-emerald-400">{activeRooms.length}</p>
                        <p className="text-xs text-gray-500">Active</p>
                      </div>
                      {avgRate > 0 && (
                        <div className="text-center">
                          <p className="text-lg font-bold text-white">{formatCurrency(avgRate)}</p>
                          <p className="text-xs text-gray-500">Avg rate</p>
                        </div>
                      )}
                    </div>
                    <PropertyEditButton
                      property={{
                        id: property.id,
                        name: property.name,
                        type: property.type,
                        address: property.address ?? null,
                        city: property.city ?? null,
                        country: property.country,
                        isActive: property.isActive,
                      }}
                    />
                  </div>
                </div>

                {/* Inline rooms section */}
                <PropertyRoomsCard
                  propertyId={property.id}
                  rooms={property.rooms.map((r) => ({
                    ...r,
                    baseRate: Number(r.baseRate),
                  }))}
                />

                {/* Invoice billing profile */}
                <PropertyBillingForm
                  propertyId={property.id}
                  initial={{
                    phone: property.phone ?? null,
                    email: property.email ?? null,
                    taxNumber: property.taxNumber ?? null,
                    logoUrl: property.logoUrl ?? null,
                    website: property.website ?? null,
                    bankName: property.bankName ?? null,
                    bankAccount: property.bankAccount ?? null,
                    bankBranch: property.bankBranch ?? null,
                    invoiceFooter: property.invoiceFooter ?? null,
                  }}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
