/**
 * MrMoney — Owner Daily WhatsApp Digest
 * Sent every morning with occupancy, arrivals, revenue, cash position
 */

import { prisma } from "@/lib/prisma";

interface DigestData {
  orgName: string;
  date: string;
  dayOfWeek: string;
  properties: PropertyDigest[];
  totalRevenueMTD: number;
  cashPosition: number;
  pendingWhatsApp: number;
  topChannel: string | null;
  topChannelPct: number;
}

interface PropertyDigest {
  name: string;
  totalRooms: number;
  occupiedTonight: number;
  checkInsToday: number;
  checkOutsToday: number;
  revenueToday: number;
}

export async function buildDigest(organisationId: string): Promise<DigestData | null> {
  const org = await prisma.organisation.findUnique({
    where: { id: organisationId },
    select: { name: true },
  });
  if (!org) return null;

  const now = new Date();
  // Use SA time
  const saTime = new Date(now.toLocaleString("en-US", { timeZone: "Africa/Johannesburg" }));
  const todayStart = new Date(saTime);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(saTime);
  todayEnd.setHours(23, 59, 59, 999);
  const monthStart = new Date(saTime.getFullYear(), saTime.getMonth(), 1);

  const properties = await prisma.property.findMany({
    where: { organisationId, isActive: true, deletedAt: null },
    include: { rooms: { where: { deletedAt: null, status: "ACTIVE" } } },
    orderBy: { name: "asc" },
  });

  const propertyDigests: PropertyDigest[] = [];

  for (const prop of properties) {
    const totalRooms = prop.rooms.length;

    // Occupied tonight: active booking overlapping today
    const occupiedTonight = await prisma.booking.count({
      where: {
        propertyId: prop.id,
        deletedAt: null,
        status: { in: ["CONFIRMED", "CHECKED_IN"] },
        checkIn: { lte: todayEnd },
        checkOut: { gt: todayStart },
      },
    });

    // Check-ins today
    const checkInsToday = await prisma.booking.count({
      where: {
        propertyId: prop.id,
        deletedAt: null,
        status: { in: ["CONFIRMED", "CHECKED_IN"] },
        checkIn: { gte: todayStart, lte: todayEnd },
      },
    });

    // Check-outs today
    const checkOutsToday = await prisma.booking.count({
      where: {
        propertyId: prop.id,
        deletedAt: null,
        status: { in: ["CHECKED_OUT", "CONFIRMED", "CHECKED_IN"] },
        checkOut: { gte: todayStart, lte: todayEnd },
      },
    });

    // Revenue today (transactions posted today)
    const todayRevResult = await prisma.transaction.aggregate({
      where: {
        organisationId,
        propertyId: prop.id,
        deletedAt: null,
        type: "INCOME",
        date: { gte: todayStart, lte: todayEnd },
      },
      _sum: { amount: true },
    });

    propertyDigests.push({
      name: prop.name,
      totalRooms,
      occupiedTonight,
      checkInsToday,
      checkOutsToday,
      revenueToday: parseFloat(String(todayRevResult._sum.amount ?? 0)),
    });
  }

  // Revenue MTD (all properties)
  const mtdResult = await prisma.transaction.aggregate({
    where: {
      organisationId,
      deletedAt: null,
      type: "INCOME",
      date: { gte: monthStart },
    },
    _sum: { amount: true },
  });
  const totalRevenueMTD = parseFloat(String(mtdResult._sum.amount ?? 0));

  // Cash position (sum of all income - expenses ever)
  const incomeResult = await prisma.transaction.aggregate({
    where: { organisationId, deletedAt: null, type: "INCOME" },
    _sum: { amount: true },
  });
  const expenseResult = await prisma.transaction.aggregate({
    where: { organisationId, deletedAt: null, type: "EXPENSE" },
    _sum: { amount: true },
  });
  const cashPosition =
    parseFloat(String(incomeResult._sum.amount ?? 0)) -
    parseFloat(String(expenseResult._sum.amount ?? 0));

  // Pending WhatsApp bookings
  const pendingWhatsApp = await prisma.whatsAppConversation.count({
    where: { organisationId, state: "CONFIRMING" },
  });

  // Top channel this month
  const channelBookings = await prisma.booking.groupBy({
    by: ["source"],
    where: {
      propertyId: { in: properties.map((p) => p.id) },
      deletedAt: null,
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      checkIn: { gte: monthStart },
    },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 1,
  });

  const totalBookings = await prisma.booking.count({
    where: {
      propertyId: { in: properties.map((p) => p.id) },
      deletedAt: null,
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      checkIn: { gte: monthStart },
    },
  });

  const SOURCE_LABELS: Record<string, string> = {
    DIRECT: "Direct",
    BOOKING_COM: "Booking.com",
    AIRBNB: "Airbnb",
    LEKKERSLAAP: "Lekkerslaap",
    WALKIN: "Walk-in",
    WHATSAPP: "WhatsApp",
    OTHER: "Other",
  };

  const topChannelSource = channelBookings[0]?.source;
  const topChannel = topChannelSource ? SOURCE_LABELS[topChannelSource] ?? topChannelSource : null;
  const topChannelPct =
    topChannel && totalBookings > 0
      ? Math.round((channelBookings[0]._count.id / totalBookings) * 100)
      : 0;

  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  return {
    orgName: org.name,
    date: saTime.toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" }),
    dayOfWeek: days[saTime.getDay()],
    properties: propertyDigests,
    totalRevenueMTD,
    cashPosition,
    pendingWhatsApp,
    topChannel,
    topChannelPct,
  };
}

export function formatDigestMessage(data: DigestData): string {
  const R = (n: number) =>
    "R" + Math.round(n).toLocaleString("en-ZA");

  const greeting =
    data.dayOfWeek === "Saturday" || data.dayOfWeek === "Sunday"
      ? "Good morning! Have a great weekend"
      : "Good morning! Here's your day";

  let msg = `☀️ *${greeting}*\n`;
  msg += `${data.dayOfWeek}, ${data.date}\n\n`;

  for (const p of data.properties) {
    const occ =
      p.totalRooms > 0 ? Math.round((p.occupiedTonight / p.totalRooms) * 100) : 0;
    const occBar = occupancyBar(occ);

    msg += `🏠 *${p.name}*\n`;
    msg += `${occBar} ${p.occupiedTonight}/${p.totalRooms} rooms (${occ}%)\n`;
    if (p.checkInsToday > 0)
      msg += `📥 Check-ins today: ${p.checkInsToday}\n`;
    if (p.checkOutsToday > 0)
      msg += `📤 Check-outs today: ${p.checkOutsToday}\n`;
    if (p.revenueToday > 0)
      msg += `💳 Revenue today: ${R(p.revenueToday)}\n`;
    msg += "\n";
  }

  msg += `📊 *Revenue MTD:* ${R(data.totalRevenueMTD)}\n`;
  msg += `💵 *Cash position:* ${R(data.cashPosition)}\n`;

  if (data.topChannel) {
    msg += `📈 *Top channel:* ${data.topChannel} (${data.topChannelPct}%)\n`;
  }

  if (data.pendingWhatsApp > 0) {
    msg += `\n⚡ ${data.pendingWhatsApp} WhatsApp booking${data.pendingWhatsApp > 1 ? "s" : ""} awaiting confirmation\n`;
  }

  msg += `\n— MrMoney 💚`;
  return msg;
}

function occupancyBar(pct: number): string {
  const filled = Math.round(pct / 20); // 5 blocks = 100%
  return "🟩".repeat(filled) + "⬜".repeat(5 - filled);
}
