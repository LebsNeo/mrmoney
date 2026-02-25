import { PageHeader } from "@/components/PageHeader";
import { NewBookingForm } from "@/components/NewBookingForm";
import { getPropertiesWithRooms } from "@/lib/actions/bookings";
import Link from "next/link";

export default async function NewBookingPage() {
  const properties = await getPropertiesWithRooms();

  if (properties.length === 0) {
    return (
      <div>
        <PageHeader title="New Booking" description="Create a new guest booking" />
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
          <p className="text-gray-400 mb-4">
            No properties found. Please create a property before adding bookings.
          </p>
          <Link
            href="/properties"
            className="px-4 py-2 rounded-xl text-sm font-medium bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
          >
            Go to Properties
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center gap-2 text-sm text-gray-400">
        <Link href="/bookings" className="hover:text-white transition-colors">
          Bookings
        </Link>
        <span>/</span>
        <span className="text-white">New Booking</span>
      </div>

      <PageHeader
        title="New Booking"
        description="Create a new guest booking"
      />

      <NewBookingForm properties={properties} />
    </div>
  );
}
