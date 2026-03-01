"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBookingComCSV, BookingComPayout } from "@/lib/ota-parsers/bookingcom";
import { parseLekkerslaapCSV, LekkerslaapPayout } from "@/lib/ota-parsers/lekkerslaap";

type SessionUser = { organisationId?: string };

async function getOrgId(): Promise<string> {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as SessionUser)?.organisationId;
  if (!orgId) throw new Error("Unauthorized");
  return orgId;
}

function serialize(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "object") {
    if (obj?.constructor?.name === "Decimal") return parseFloat(String(obj));
    if (obj instanceof Date) return obj.toISOString();
    if (Array.isArray(obj)) return obj.map(serialize);
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, serialize(v)])
    );
  }
  return obj;
}

// ─────────────────────────────────────────────────────────────────────────────
// PREVIEW: Parse OTA file + find matching bank transactions (no writes)
// ─────────────────────────────────────────────────────────────────────────────

export interface ReconcilePreviewItem {
  // From OTA file
  descriptor: string
  payoutAmount: number
  payoutDate: string
  reservationCount: number
  grossTotal: number
  commissionTotal: number
  platform: string

  // Bank match result
  bankTransactionId: string | null
  bankAmount: number | null
  bankDate: string | null
  bankDescription: string | null
  matchConfidence: "HIGH" | "MEDIUM" | "NONE"
  matchMethod: string

  // Already reconciled?
  alreadyReconciled: boolean
}

export async function previewOTAReconciliation(formData: FormData) {
  try {
    const orgId = await getOrgId();
    const platform = (formData.get("platform") as string ?? "").toUpperCase();
    const propertyId = formData.get("propertyId") as string;
    const file = formData.get("file") as File;

    if (!file || !platform || !propertyId) {
      return { ok: false, error: "Missing required fields" };
    }

    const csvContent = await file.text();

    // Load bank transactions for this property (income only, unreconciled)
    const bankTxns = await prisma.transaction.findMany({
      where: {
        propertyId,
        organisationId: orgId,
        type: "INCOME",
        deletedAt: null,
        status: { not: "RECONCILED" },
      },
      select: {
        id: true,
        amount: true,
        date: true,
        description: true,
        status: true,
      },
      orderBy: { date: "desc" },
    });

    const items: ReconcilePreviewItem[] = [];

    if (platform === "BOOKING_COM") {
      const parsed = parseBookingComCSV(csvContent);

      for (const payout of parsed.payouts) {
        const match = findBankMatchBookingCom(payout, bankTxns);
        const grossTotal = payout.reservations.reduce((s, r) => s + r.grossAmount, 0);
        const commTotal = payout.reservations.reduce(
          (s, r) => s + Math.abs(r.commission) + Math.abs(r.serviceFee) + Math.abs(r.vat), 0
        );

        // Check if already reconciled
        const existingPayout = await prisma.oTAPayout.findFirst({
          where: {
            organisationId: orgId,
            propertyId,
            platform: "BOOKING_COM",
            notes: { contains: payout.statementDescriptor },
          },
          select: { id: true },
        });

        items.push({
          descriptor: payout.statementDescriptor,
          payoutAmount: payout.payoutAmount,
          payoutDate: payout.payoutDate.toISOString(),
          reservationCount: payout.reservations.length,
          grossTotal,
          commissionTotal: commTotal,
          platform: "BOOKING_COM",
          bankTransactionId: match?.id ?? null,
          bankAmount: match ? parseFloat(String(match.amount)) : null,
          bankDate: match?.date.toISOString() ?? null,
          bankDescription: match?.description ?? null,
          matchConfidence: match ? "HIGH" : "NONE",
          matchMethod: match ? "Statement Descriptor (exact)" : "No match",
          alreadyReconciled: !!existingPayout,
        });
      }

    } else if (platform === "LEKKERSLAAP") {
      const parsed = parseLekkerslaapCSV(csvContent);

      for (const payout of parsed.payouts) {
        const match = findBankMatchLekkerslaap(payout, bankTxns);
        const grossTotal = payout.bookings.reduce((s, b) => s + b.guestPayment, 0);
        const commTotal = payout.bookings.reduce(
          (s, b) => s + Math.abs(b.commission) + Math.abs(b.paymentHandlingFee), 0
        );

        const existingPayout = await prisma.oTAPayout.findFirst({
          where: {
            organisationId: orgId,
            propertyId,
            platform: "LEKKERSLAAP",
            payoutDate: {
              gte: new Date(payout.payoutDate.getTime() - 86400000),
              lte: new Date(payout.payoutDate.getTime() + 86400000),
            },
            netAmount: { gte: payout.payoutAmount - 1, lte: payout.payoutAmount + 1 },
          },
          select: { id: true },
        });

        items.push({
          descriptor: `LEKKESLAAP-${payout.payoutDate.toISOString().slice(0, 10)}-${payout.payoutAmount}`,
          payoutAmount: payout.payoutAmount,
          payoutDate: payout.payoutDate.toISOString(),
          reservationCount: payout.bookings.length,
          grossTotal,
          commissionTotal: commTotal,
          platform: "LEKKERSLAAP",
          bankTransactionId: match?.id ?? null,
          bankAmount: match ? parseFloat(String(match.amount)) : null,
          bankDate: match?.date.toISOString() ?? null,
          bankDescription: match?.description ?? null,
          matchConfidence: match ? "HIGH" : "NONE",
          matchMethod: match ? "Amount + Date + Keyword" : "No match",
          alreadyReconciled: !!existingPayout,
        });
      }
    } else {
      return { ok: false, error: `Platform ${platform} not yet supported` };
    }

    return { ok: true, data: serialize(items) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIRM: Write OTAPayout records + mark bank transactions RECONCILED
// ─────────────────────────────────────────────────────────────────────────────

export async function confirmOTAReconciliation(formData: FormData) {
  try {
    const orgId = await getOrgId();
    const platform = (formData.get("platform") as string ?? "").toUpperCase();
    const propertyId = formData.get("propertyId") as string;
    const file = formData.get("file") as File;
    const selectedJson = formData.get("selected") as string; // JSON array of descriptors to confirm

    if (!file || !platform || !propertyId || !selectedJson) {
      return { ok: false, error: "Missing required fields" };
    }

    const selectedDescriptors: string[] = JSON.parse(selectedJson);
    const matchMapJson = formData.get("matchMap") as string; // { descriptor: bankTxnId }
    const matchMap: Record<string, string> = JSON.parse(matchMapJson ?? "{}");

    const csvContent = await file.text();
    let saved = 0;

    if (platform === "BOOKING_COM") {
      const parsed = parseBookingComCSV(csvContent);

      for (const payout of parsed.payouts) {
        if (!selectedDescriptors.includes(payout.statementDescriptor)) continue;

        const bankTxnId = matchMap[payout.statementDescriptor];
        const grossTotal = payout.reservations.reduce((s, r) => s + r.grossAmount, 0);
        const commTotal = payout.reservations.reduce(
          (s, r) => s + Math.abs(r.commission) + Math.abs(r.serviceFee) + Math.abs(r.vat), 0
        );

        await prisma.$transaction(async (tx) => {
          // Create OTAPayout record
          const otaPayout = await tx.oTAPayout.create({
            data: {
              organisationId: orgId,
              propertyId,
              platform: "BOOKING_COM",
              periodStart: payout.reservations.reduce(
                (min, r) => r.checkIn < min ? r.checkIn : min,
                payout.reservations[0]?.checkIn ?? payout.payoutDate
              ),
              periodEnd: payout.payoutDate,
              payoutDate: payout.payoutDate,
              grossAmount: grossTotal,
              totalCommission: commTotal,
              netAmount: payout.payoutAmount,
              status: "RECONCILED",
              importFilename: file.name,
              notes: payout.statementDescriptor,
            },
          });

          // Create OTAPayoutItems for each reservation
          for (const res of payout.reservations) {
            await tx.oTAPayoutItem.create({
              data: {
                payoutId: otaPayout.id,
                externalBookingRef: res.referenceNumber,
                guestName: `Booking.com #${res.referenceNumber}`,
                checkIn: res.checkIn,
                checkOut: res.checkOut,
                grossAmount: res.grossAmount,
                commission: Math.abs(res.commission) + Math.abs(res.serviceFee) + Math.abs(res.vat),
                netAmount: res.transactionAmount,
                isMatched: true,
              },
            });
          }

          // Mark bank transaction as RECONCILED
          if (bankTxnId) {
            await tx.transaction.update({
              where: { id: bankTxnId },
              data: { status: "RECONCILED" },
            });
          }
        });

        saved++;
      }

    } else if (platform === "LEKKERSLAAP") {
      const parsed = parseLekkerslaapCSV(csvContent);

      for (const payout of parsed.payouts) {
        const descriptor = `LEKKESLAAP-${payout.payoutDate.toISOString().slice(0, 10)}-${payout.payoutAmount}`;
        if (!selectedDescriptors.includes(descriptor)) continue;

        const bankTxnId = matchMap[descriptor];
        const grossTotal = payout.bookings.reduce((s, b) => s + b.guestPayment, 0);
        const commTotal = payout.bookings.reduce(
          (s, b) => s + Math.abs(b.commission) + Math.abs(b.paymentHandlingFee), 0
        );

        await prisma.$transaction(async (tx) => {
          const otaPayout = await tx.oTAPayout.create({
            data: {
              organisationId: orgId,
              propertyId,
              platform: "LEKKERSLAAP",
              periodStart: payout.bookings.length > 0
                ? payout.bookings.reduce((min, b) => b.date < min ? b.date : min, payout.bookings[0].date)
                : payout.payoutDate,
              periodEnd: payout.payoutDate,
              payoutDate: payout.payoutDate,
              grossAmount: grossTotal,
              totalCommission: commTotal,
              netAmount: payout.payoutAmount,
              status: "RECONCILED",
              importFilename: file.name,
              notes: descriptor,
            },
          });

          for (const booking of payout.bookings) {
            await tx.oTAPayoutItem.create({
              data: {
                payoutId: otaPayout.id,
                externalBookingRef: booking.bookingRef,
                guestName: `Lekkerslaap ${booking.bookingRef}`,
                checkIn: booking.date,
                checkOut: booking.date,
                grossAmount: booking.guestPayment,
                commission: Math.abs(booking.commission) + Math.abs(booking.paymentHandlingFee),
                netAmount: booking.netAmount,
                isMatched: true,
              },
            });
          }

          if (bankTxnId) {
            await tx.transaction.update({
              where: { id: bankTxnId },
              data: { status: "RECONCILED" },
            });
          }
        });

        saved++;
      }
    }

    return { ok: true, data: { saved } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Matching helpers
// ─────────────────────────────────────────────────────────────────────────────

type BankTxn = {
  id: string;
  amount: unknown;
  date: Date;
  description: string;
  status: string;
};

function findBankMatchBookingCom(
  payout: BookingComPayout,
  bankTxns: BankTxn[]
): BankTxn | null {
  const descriptor = payout.statementDescriptor.toUpperCase();
  return bankTxns.find(t =>
    t.description.toUpperCase().includes(descriptor)
  ) ?? null;
}

function findBankMatchLekkerslaap(
  payout: LekkerslaapPayout,
  bankTxns: BankTxn[]
): BankTxn | null {
  const targetAmt = payout.payoutAmount;
  const targetDate = payout.payoutDate;
  const windowMs = 4 * 86400000; // ±4 days

  return bankTxns.find(t => {
    const amt = parseFloat(String(t.amount));
    const dateDiff = Math.abs(t.date.getTime() - targetDate.getTime());
    const amtMatch = Math.abs(amt - targetAmt) < 0.10;
    const dateMatch = dateDiff <= windowMs;
    const keyword = t.description.toUpperCase().includes("LEKKESLAAP") ||
                    t.description.toUpperCase().includes("LEKKERSLAAP");
    return amtMatch && dateMatch && keyword;
  }) ?? null;
}
