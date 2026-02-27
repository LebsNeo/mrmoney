"use client";

import { useState } from "react";
import { PropertyFormModal } from "./PropertyFormModal";

export function AddPropertyButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-white transition-colors"
      >
        + Add Property
      </button>
      {open && (
        <PropertyFormModal
          mode="create"
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
