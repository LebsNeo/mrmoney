"use client";

import { useState } from "react";
import { PropertyType } from "@prisma/client";
import { PropertyFormModal } from "./PropertyFormModal";

interface Props {
  property: {
    id: string;
    name: string;
    type: PropertyType;
    address: string | null;
    city: string | null;
    country: string;
    isActive: boolean;
  };
}

export function PropertyEditButton({ property }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 rounded-lg text-xs bg-gray-800 border border-gray-700 text-gray-400 hover:text-white transition-colors"
      >
        ✏️ Edit
      </button>
      {open && (
        <PropertyFormModal
          mode="edit"
          propertyId={property.id}
          initial={property}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
