"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PropertyType } from "@prisma/client";
import { logger } from "@/lib/logger";

async function getOrgId(): Promise<string> {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as { organisationId?: string })?.organisationId;
  if (!orgId) throw new Error("Unauthorised");
  return orgId;
}

// ─────────────────────────────────────────────
// CREATE PROPERTY
// ─────────────────────────────────────────────

export interface PropertyDetailsInput {
  name: string;
  type: PropertyType;
  address?: string;
  city?: string;
  country?: string;
}

export async function createProperty(data: PropertyDetailsInput) {
  try {
    const orgId = await getOrgId();

    if (!data.name?.trim()) return { success: false, message: "Property name is required" };

    const property = await prisma.property.create({
      data: {
        organisationId: orgId,
        name: data.name.trim(),
        type: data.type,
        address: data.address?.trim() || null,
        city: data.city?.trim() || null,
        country: data.country?.trim() || "ZA",
      },
    });

    revalidatePath("/properties");
    logger.info("Property created", { propertyId: property.id });
    return { success: true, message: "Property created successfully", propertyId: property.id };
  } catch (err) {
    logger.error("createProperty failed", err);
    return { success: false, message: "Failed to create property" };
  }
}

// ─────────────────────────────────────────────
// UPDATE PROPERTY DETAILS
// ─────────────────────────────────────────────

export interface UpdatePropertyDetailsInput extends PropertyDetailsInput {
  isActive?: boolean;
}

export async function updatePropertyDetails(
  propertyId: string,
  data: UpdatePropertyDetailsInput
) {
  try {
    const orgId = await getOrgId();

    const existing = await prisma.property.findFirst({
      where: { id: propertyId, organisationId: orgId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) return { success: false, message: "Property not found" };

    if (!data.name?.trim()) return { success: false, message: "Property name is required" };

    await prisma.property.update({
      where: { id: propertyId },
      data: {
        name: data.name.trim(),
        type: data.type,
        address: data.address?.trim() || null,
        city: data.city?.trim() || null,
        country: data.country?.trim() || "ZA",
        isActive: data.isActive ?? true,
      },
    });

    revalidatePath("/properties");
    revalidatePath("/dashboard");
    logger.info("Property updated", { propertyId });
    return { success: true, message: "Property updated successfully" };
  } catch (err) {
    logger.error("updatePropertyDetails failed", err);
    return { success: false, message: "Failed to update property" };
  }
}

export interface BillingProfileInput {
  phone?: string;
  email?: string;
  taxNumber?: string;
  logoUrl?: string;   // base64 data URL from client
  website?: string;
  bankName?: string;
  bankAccount?: string;
  bankBranch?: string;
  invoiceFooter?: string;
}

export async function updatePropertyBillingProfile(
  propertyId: string,
  data: BillingProfileInput
) {
  try {
    const orgId = await getOrgId();

    // Verify property belongs to this org
    const property = await prisma.property.findFirst({
      where: { id: propertyId, organisationId: orgId, deletedAt: null },
      select: { id: true },
    });
    if (!property) return { success: false, message: "Property not found" };

    // Sanitise: strip empty strings to null
    await prisma.property.update({
      where: { id: propertyId },
      data: {
        phone: data.phone?.trim() || null,
        email: data.email?.trim() || null,
        taxNumber: data.taxNumber?.trim() || null,
        logoUrl: data.logoUrl?.trim() || null,
        website: data.website?.trim() || null,
        bankName: data.bankName?.trim() || null,
        bankAccount: data.bankAccount?.trim() || null,
        bankBranch: data.bankBranch?.trim() || null,
        invoiceFooter: data.invoiceFooter?.trim() || null,
      },
    });

    revalidatePath("/properties");
    logger.info("Property billing profile updated", { propertyId });
    return { success: true, message: "Billing profile saved" };
  } catch (err) {
    logger.error("updatePropertyBillingProfile failed", err);
    return { success: false, message: "Failed to save billing profile" };
  }
}
