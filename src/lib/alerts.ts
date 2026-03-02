/**
 * MrCA — Alerts Engine
 * Generates HIGH / MEDIUM / INFO alerts for an organisation
 */

import { AlertPriority, AlertType } from "@prisma/client";
import { prisma } from "./prisma";
import { getOverdueRecurring } from "./recurring";
import {
  startOfMonth,
  endOfMonth,
  subDays,
  format,
} from "date-fns";

// ─────────────────────────────────────────────
// generateAlerts
// ─────────────────────────────────────────────

export async function generateAlerts(organisationId: string) {
  const today = new Date();
  const period = format(today, "yyyy-MM");
  const [year, month] = period.split("-").map(Number);
  const monthStart = startOfMonth(new Date(year, month - 1, 1));
  const monthEnd = endOfMonth(monthStart);

  // Collect all alert payloads we want to create
  type AlertPayload = {
    alertType: AlertType;
    priority: AlertPriority;
    title: string;
    message: string;
    actionUrl?: string;
    dedupeKey: string; // used to avoid duplicate unread alerts
  };

  const payloads: AlertPayload[] = [];

  // ── HIGH: Overdue invoices ──
  const overdueInvoices = await prisma.invoice.findMany({
    where: {
      organisationId,
      status: "SENT",
      dueDate: { lt: today },
      deletedAt: null,
    },
    select: { id: true, invoiceNumber: true, totalAmount: true },
  });
  for (const inv of overdueInvoices) {
    payloads.push({
      alertType: "FINANCIAL",
      priority: "HIGH",
      title: "Invoice Overdue",
      message: `Invoice ${inv.invoiceNumber} (R${parseFloat(inv.totalAmount.toString()).toFixed(2)}) is overdue.`,
      actionUrl: "/invoices",
      dedupeKey: `overdue-invoice-${inv.id}`,
    });
  }

  // ── HIGH: OTA payouts long overdue (IMPORTED and payoutDate < today - 35d) ──
  const longOverduePayouts = await prisma.oTAPayout.findMany({
    where: {
      organisationId,
      status: "IMPORTED",
      payoutDate: { lt: subDays(today, 35) },
      deletedAt: null,
    },
    select: { id: true, platform: true, payoutDate: true, netAmount: true },
  });
  for (const payout of longOverduePayouts) {
    payloads.push({
      alertType: "FINANCIAL",
      priority: "HIGH",
      title: "OTA Payout Overdue",
      message: `${payout.platform} payout from ${format(payout.payoutDate, "dd MMM yyyy")} (R${parseFloat(payout.netAmount.toString()).toFixed(2)}) has not been reconciled.`,
      actionUrl: "/ota-payouts",
      dedupeKey: `overdue-payout-${payout.id}`,
    });
  }

  // ── HIGH: Budget category actual > 110% of budgeted (current month) ──
  const properties = await prisma.property.findMany({
    where: { organisationId, isActive: true, deletedAt: null },
    select: { id: true, name: true },
  });

  for (const prop of properties) {
    const budgetItems = await prisma.budgetItem.findMany({
      where: { propertyId: prop.id, period, deletedAt: null },
      select: { category: true, budgetedAmount: true },
    });

    for (const bi of budgetItems) {
      const actual = await prisma.transaction.aggregate({
        where: {
          propertyId: prop.id,
          category: bi.category,
          type: "EXPENSE",
          deletedAt: null,
          date: { gte: monthStart, lte: monthEnd },
        },
        _sum: { amount: true },
      });
      const actualAmt = parseFloat((actual._sum.amount ?? 0).toString());
      const budgeted = parseFloat(bi.budgetedAmount.toString());
      if (budgeted > 0 && actualAmt > budgeted * 1.1) {
        payloads.push({
          alertType: "FINANCIAL",
          priority: "HIGH",
          title: "Budget Exceeded",
          message: `${bi.category.replace(/_/g, " ")} at ${prop.name} is at R${actualAmt.toFixed(2)} vs budget R${budgeted.toFixed(2)} (${((actualAmt / budgeted - 1) * 100).toFixed(0)}% over).`,
          actionUrl: "/budget",
          dedupeKey: `over-budget-${prop.id}-${bi.category}-${period}`,
        });
      }
    }
  }

  // ── HIGH: Unmatched OTA payout items with netAmount > 500 ──
  const unmatchedItems = await prisma.oTAPayoutItem.findMany({
    where: {
      isMatched: false,
      deletedAt: null,
      netAmount: { gt: 500 },
      payout: { organisationId },
    },
    select: { id: true, guestName: true, netAmount: true, checkIn: true },
    take: 20,
  });
  if (unmatchedItems.length > 0) {
    payloads.push({
      alertType: "FINANCIAL",
      priority: "HIGH",
      title: "Unmatched OTA Payout Items",
      message: `${unmatchedItems.length} OTA payout item(s) over R500 are unmatched. Review and reconcile.`,
      actionUrl: "/ota-payouts",
      dedupeKey: `unmatched-ota-items-${period}`,
    });
  }

  // ── MEDIUM: Rooms with no bookings in last 21 days ──
  const twentyOneDaysAgo = subDays(today, 21);
  for (const prop of properties) {
    const rooms = await prisma.room.findMany({
      where: { propertyId: prop.id, status: "ACTIVE", deletedAt: null },
      select: { id: true, name: true },
    });

    for (const room of rooms) {
      const recentBooking = await prisma.booking.findFirst({
        where: {
          roomId: room.id,
          deletedAt: null,
          status: { in: ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] },
          checkIn: { gte: twentyOneDaysAgo },
        },
        select: { id: true },
      });
      if (!recentBooking) {
        payloads.push({
          alertType: "OPERATIONAL",
          priority: "MEDIUM",
          title: "Room Idle",
          message: `${room.name} at ${prop.name} has had no bookings in the last 21 days.`,
          actionUrl: "/bookings",
          dedupeKey: `idle-room-${room.id}-${period}`,
        });
      }
    }
  }

  // ── MEDIUM: Cancellation rate > 15% this month ──
  for (const prop of properties) {
    const totalBookings = await prisma.booking.count({
      where: {
        propertyId: prop.id,
        deletedAt: null,
        checkIn: { gte: monthStart, lte: monthEnd },
      },
    });
    const cancelledBookings = await prisma.booking.count({
      where: {
        propertyId: prop.id,
        deletedAt: null,
        status: "CANCELLED",
        checkIn: { gte: monthStart, lte: monthEnd },
      },
    });
    if (totalBookings > 0 && cancelledBookings / totalBookings > 0.15) {
      const rate = ((cancelledBookings / totalBookings) * 100).toFixed(1);
      payloads.push({
        alertType: "OPERATIONAL",
        priority: "MEDIUM",
        title: "High Cancellation Rate",
        message: `Cancellation rate at ${prop.name} is ${rate}% this month (${cancelledBookings} of ${totalBookings} bookings).`,
        actionUrl: "/bookings",
        dedupeKey: `cancellation-rate-${prop.id}-${period}`,
      });
    }
  }

  // ── MEDIUM: Overdue recurring expenses ──
  for (const prop of properties) {
    const overdue = await getOverdueRecurring(prop.id);
    if (overdue.length > 0) {
      payloads.push({
        alertType: "FINANCIAL",
        priority: "MEDIUM",
        title: "Recurring Expenses Overdue",
        message: `${overdue.length} recurring expense(s) at ${prop.name} are expected but missing this month.`,
        actionUrl: "/automation",
        dedupeKey: `overdue-recurring-${prop.id}-${period}`,
      });
    }
  }

  // ── INFO: Occupancy > 90% this month ──
  for (const prop of properties) {
    const totalRooms = await prisma.room.count({
      where: { propertyId: prop.id, status: "ACTIVE", deletedAt: null },
    });
    const daysInMonth = monthEnd.getDate();
    const totalAvailableNights = totalRooms * daysInMonth;

    if (totalAvailableNights > 0) {
      // Count occupied room nights
      const bookings = await prisma.booking.findMany({
        where: {
          propertyId: prop.id,
          deletedAt: null,
          status: { in: ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] },
          checkIn: { lte: monthEnd },
          checkOut: { gte: monthStart },
        },
        select: { checkIn: true, checkOut: true },
      });

      let occupiedNights = 0;
      for (const b of bookings) {
        const checkIn = new Date(b.checkIn) < monthStart ? monthStart : new Date(b.checkIn);
        const checkOut = new Date(b.checkOut) > monthEnd ? monthEnd : new Date(b.checkOut);
        const nights = Math.max(
          0,
          (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)
        );
        occupiedNights += nights;
      }

      const occupancyRate = occupiedNights / totalAvailableNights;
      if (occupancyRate > 0.9) {
        payloads.push({
          alertType: "INFO",
          priority: "LOW",
          title: "🎉 High Occupancy!",
          message: `Occupancy at ${prop.name} is ${(occupancyRate * 100).toFixed(1)}% this month — outstanding performance!`,
          actionUrl: "/kpis",
          dedupeKey: `high-occupancy-${prop.id}-${period}`,
        });
      }
    }
  }

  // ── INFO: Record revenue month ──
  for (const prop of properties) {
    const thisMonthRevenue = await prisma.transaction.aggregate({
      where: {
        propertyId: prop.id,
        type: "INCOME",
        deletedAt: null,
        date: { gte: monthStart, lte: monthEnd },
      },
      _sum: { amount: true },
    });

    const thisMonthAmt = parseFloat((thisMonthRevenue._sum.amount ?? 0).toString());

    if (thisMonthAmt > 0) {
      // Get max revenue from all previous months
      const prevMonthsRevenue = await prisma.$queryRaw<{ total: string; period: string }[]>`
        SELECT
          to_char(date, 'YYYY-MM') as period,
          SUM(amount)::text as total
        FROM transactions
        WHERE "propertyId" = ${prop.id}
          AND type = 'INCOME'
          AND "deletedAt" IS NULL
          AND date < ${monthStart}
        GROUP BY to_char(date, 'YYYY-MM')
        ORDER BY total DESC
        LIMIT 1
      `;

      if (prevMonthsRevenue.length > 0) {
        const prevMax = parseFloat(prevMonthsRevenue[0].total);
        if (thisMonthAmt > prevMax) {
          payloads.push({
            alertType: "INFO",
            priority: "LOW",
            title: "🏆 Record Revenue Month!",
            message: `${prop.name} has achieved its highest revenue ever this month: R${thisMonthAmt.toFixed(2)}.`,
            actionUrl: "/profitability",
            dedupeKey: `record-revenue-${prop.id}-${period}`,
          });
        }
      }
    }
  }

  // ── Upsert alerts (skip if unread duplicate already exists) ──
  for (const payload of payloads) {
    // Check for existing unread alert with same dedupeKey (stored in title as prefix check)
    const existing = await prisma.alert.findFirst({
      where: {
        organisationId,
        isRead: false,
        title: payload.title,
        message: payload.message,
      },
    });

    if (!existing) {
      await prisma.alert.create({
        data: {
          organisationId,
          alertType: payload.alertType,
          priority: payload.priority,
          title: payload.title,
          message: payload.message,
          actionUrl: payload.actionUrl,
        },
      });
    }
  }

  // Return all unread alerts sorted by priority then createdAt
  const priorityOrder: Record<AlertPriority, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

  const alerts = await prisma.alert.findMany({
    where: { organisationId, isRead: false },
    orderBy: [{ createdAt: "asc" }],
  });

  return alerts.sort(
    (a, b) =>
      priorityOrder[a.priority] - priorityOrder[b.priority] ||
      a.createdAt.getTime() - b.createdAt.getTime()
  );
}
