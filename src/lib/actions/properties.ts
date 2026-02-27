"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logger } from "@/lib/logger";

async function getOrgId(): Promise<string> {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as { organisationId?: string })?.organisationId;
  if (!orgId) throw new Error("Unauthorised");
  return orgId;
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
