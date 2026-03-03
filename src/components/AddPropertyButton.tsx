"use client";

import { useState } from "react";
import { PropertyFormModal } from "./PropertyFormModal";

export function AddPropertyButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-primary"
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
