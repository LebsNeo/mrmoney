/**
 * MrMoney — Phase 1 Seed Script
 * Realistic hospitality data for development & testing
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, BookingStatus, BookingSource, TransactionType, TransactionSource, TransactionCategory, TransactionStatus, InvoiceStatus, PaymentMethod, OTAPlatform, OTAPayoutStatus } from "@prisma/client";
import * as dotenv from "dotenv";
dotenv.config();
import bcrypt from "bcryptjs";
import { addDays, subDays, format, startOfMonth } from "date-fns";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const today = new Date();
const d = (daysOffset: number) => addDays(today, daysOffset);
const p = (daysAgo: number) => subDays(today, daysAgo);

async function main() {
  console.log("🌱 Seeding MrMoney database...\n");

  // ─────────────────────────────────────────────
  // ORGANISATION
  // ─────────────────────────────────────────────
  console.log("📦 Creating organisation...");
  const org = await prisma.organisation.upsert({
    where: { slug: "sunset-hospitality-group" },
    update: {},
    create: {
      name: "Sunset Hospitality Group",
      slug: "sunset-hospitality-group",
      plan: "STARTER",
      currency: "ZAR",
      vatRegistered: true,
      vatNumber: "4670123456",
      defaultVatRate: 0.15,
    },
  });

  // ─────────────────────────────────────────────
  // USER (Owner)
  // ─────────────────────────────────────────────
  console.log("👤 Creating owner...");
  const passwordHash = await bcrypt.hash("MrMoney2025!", 12);
  const owner = await prisma.user.upsert({
    where: { email: "lebs@sunsethospitality.co.za" },
    update: {},
    create: {
      organisationId: org.id,
      email: "lebs@sunsethospitality.co.za",
      name: "Lebohang Neo",
      passwordHash,
      role: "OWNER",
      isActive: true,
    },
  });

  // ─────────────────────────────────────────────
  // PROPERTIES
  // ─────────────────────────────────────────────
  console.log("🏨 Creating properties...");
  const sandton = await prisma.property.upsert({
    where: { id: "prop-sandton-001" },
    update: {},
    create: {
      id: "prop-sandton-001",
      organisationId: org.id,
      name: "Sunset Guesthouse Sandton",
      type: "GUESTHOUSE",
      address: "14 Rivonia Road",
      city: "Sandton",
      country: "ZA",
      timezone: "Africa/Johannesburg",
      currency: "ZAR",
    },
  });

  const kalahari = await prisma.property.upsert({
    where: { id: "prop-kalahari-001" },
    update: {},
    create: {
      id: "prop-kalahari-001",
      organisationId: org.id,
      name: "Kalahari Bush Lodge",
      type: "LODGE",
      address: "Farm 23, Kuruman Road",
      city: "Upington",
      country: "ZA",
      timezone: "Africa/Johannesburg",
      currency: "ZAR",
    },
  });

  // ─────────────────────────────────────────────
  // DEPARTMENTS
  // ─────────────────────────────────────────────
  console.log("🏢 Creating departments...");
  const depts: Record<string, any> = {};

  for (const [propId, propName] of [[sandton.id, "sandton"], [kalahari.id, "kalahari"]]) {
    for (const name of ["Front Office", "Food & Beverage", "Housekeeping"]) {
      const key = `${propName}-${name.toLowerCase().replace(/ /g, "-").replace(/&/g, "n")}`;
      depts[key] = await prisma.department.create({
        data: { propertyId: propId as string, name },
      });
    }
  }

  // ─────────────────────────────────────────────
  // ROOMS — Sandton (5 rooms)
  // ─────────────────────────────────────────────
  console.log("🛏️  Creating rooms...");
  const sandtonRooms = await Promise.all([
    prisma.room.create({ data: { propertyId: sandton.id, name: "Room 1 - Standard Single", type: "SINGLE", baseRate: 750, maxOccupancy: 1 } }),
    prisma.room.create({ data: { propertyId: sandton.id, name: "Room 2 - Standard Double", type: "DOUBLE", baseRate: 1200, maxOccupancy: 2 } }),
    prisma.room.create({ data: { propertyId: sandton.id, name: "Room 3 - Standard Double", type: "DOUBLE", baseRate: 1200, maxOccupancy: 2 } }),
    prisma.room.create({ data: { propertyId: sandton.id, name: "Room 4 - Queen Deluxe", type: "QUEEN", baseRate: 1650, maxOccupancy: 2 } }),
    prisma.room.create({ data: { propertyId: sandton.id, name: "Room 5 - Executive Suite", type: "SUITE", baseRate: 2800, maxOccupancy: 3 } }),
  ]);

  const kalahariRooms = await Promise.all([
    prisma.room.create({ data: { propertyId: kalahari.id, name: "Chalet 1 - Bush Double", type: "DOUBLE", baseRate: 1800, maxOccupancy: 2 } }),
    prisma.room.create({ data: { propertyId: kalahari.id, name: "Chalet 2 - King Suite", type: "KING", baseRate: 2400, maxOccupancy: 2 } }),
    prisma.room.create({ data: { propertyId: kalahari.id, name: "Chalet 3 - Family Suite", type: "SUITE", baseRate: 3200, maxOccupancy: 4 } }),
  ]);

  // ─────────────────────────────────────────────
  // VENDORS
  // ─────────────────────────────────────────────
  console.log("🏪 Creating vendors...");
  const vendors = await Promise.all([
    prisma.vendor.create({ data: { organisationId: org.id, name: "Fresh Produce Suppliers", category: "FOOD", contactName: "Thabo Molefe", phone: "011 555 0001" } }),
    prisma.vendor.create({ data: { organisationId: org.id, name: "CleanPro Services", category: "CLEANING", contactName: "Naledi Dlamini", phone: "011 555 0002" } }),
    prisma.vendor.create({ data: { organisationId: org.id, name: "City Power", category: "UTILITIES", phone: "011 490 7000" } }),
    prisma.vendor.create({ data: { organisationId: org.id, name: "FixIt Maintenance", category: "MAINTENANCE", contactName: "Johan van Wyk", phone: "082 555 0004" } }),
    prisma.vendor.create({ data: { organisationId: org.id, name: "LinenPlus", category: "LINEN", contactName: "Zanele Khumalo", phone: "011 555 0005" } }),
  ]);

  const [vendorFood, vendorCleaning, vendorUtilities, vendorMaintenance, vendorLinen] = vendors;

  // ─────────────────────────────────────────────
  // BOOKINGS — 40 bookings over 90 days
  // ─────────────────────────────────────────────
  console.log("📅 Creating bookings...");

  const bookingData = [
    // --- SANDTON: Past bookings (checked out) ---
    { room: sandtonRooms[1], checkIn: p(60), nights: 3, source: "DIRECT" as BookingSource, guest: "Sipho Nkosi", email: "sipho@email.com", status: "CHECKED_OUT" as BookingStatus },
    { room: sandtonRooms[2], checkIn: p(58), nights: 2, source: "AIRBNB" as BookingSource, guest: "Jane Cooper", email: "jane@email.com", status: "CHECKED_OUT" as BookingStatus, extRef: "AIR-001-JANE" },
    { room: sandtonRooms[0], checkIn: p(55), nights: 1, source: "BOOKING_COM" as BookingSource, guest: "Marco Rossi", status: "CHECKED_OUT" as BookingStatus, extRef: "BDC-001-MARCO" },
    { room: sandtonRooms[3], checkIn: p(50), nights: 4, source: "DIRECT" as BookingSource, guest: "Lerato Mokoena", email: "lerato@email.com", status: "CHECKED_OUT" as BookingStatus },
    { room: sandtonRooms[4], checkIn: p(45), nights: 2, source: "AIRBNB" as BookingSource, guest: "David Kim", email: "dkim@email.com", status: "CHECKED_OUT" as BookingStatus, extRef: "AIR-002-DKIM" },
    { room: sandtonRooms[1], checkIn: p(42), nights: 3, source: "BOOKING_COM" as BookingSource, guest: "Fatima Ismail", status: "CHECKED_OUT" as BookingStatus, extRef: "BDC-002-FIT" },
    { room: sandtonRooms[2], checkIn: p(38), nights: 2, source: "WALKIN" as BookingSource, guest: "Tom Bradley", status: "CHECKED_OUT" as BookingStatus },
    { room: sandtonRooms[0], checkIn: p(35), nights: 2, source: "AIRBNB" as BookingSource, guest: "Amara Diallo", extRef: "AIR-003-AMD", status: "CHECKED_OUT" as BookingStatus },
    { room: sandtonRooms[3], checkIn: p(30), nights: 5, source: "DIRECT" as BookingSource, guest: "Nomsa Dube", email: "nomsa@email.com", status: "CHECKED_OUT" as BookingStatus },
    { room: sandtonRooms[4], checkIn: p(28), nights: 2, source: "BOOKING_COM" as BookingSource, guest: "Carlos Mendez", extRef: "BDC-003-CRM", status: "CHECKED_OUT" as BookingStatus },
    { room: sandtonRooms[1], checkIn: p(25), nights: 3, source: "AIRBNB" as BookingSource, guest: "Priya Sharma", extRef: "AIR-004-PRS", status: "CHECKED_OUT" as BookingStatus },
    { room: sandtonRooms[2], checkIn: p(22), nights: 1, source: "DIRECT" as BookingSource, guest: "Neo Sithole", email: "neo@email.com", status: "CHECKED_OUT" as BookingStatus },
    // Cancellations
    { room: sandtonRooms[0], checkIn: p(40), nights: 2, source: "BOOKING_COM" as BookingSource, guest: "Anna Mueller", extRef: "BDC-CAN-001", status: "CANCELLED" as BookingStatus },
    { room: sandtonRooms[3], checkIn: p(20), nights: 3, source: "AIRBNB" as BookingSource, guest: "Ben Foster", extRef: "AIR-CAN-001", status: "CANCELLED" as BookingStatus },
    // No show
    { room: sandtonRooms[2], checkIn: p(15), nights: 2, source: "DIRECT" as BookingSource, guest: "Unknown Guest", status: "NO_SHOW" as BookingStatus },
    // Current / upcoming
    { room: sandtonRooms[1], checkIn: p(2), nights: 4, source: "DIRECT" as BookingSource, guest: "Bongani Zulu", email: "bongani@email.com", status: "CHECKED_IN" as BookingStatus },
    { room: sandtonRooms[4], checkIn: p(1), nights: 3, source: "AIRBNB" as BookingSource, guest: "Sarah Williams", extRef: "AIR-005-SRW", status: "CHECKED_IN" as BookingStatus },
    { room: sandtonRooms[0], checkIn: d(1), nights: 2, source: "BOOKING_COM" as BookingSource, guest: "James Okonkwo", extRef: "BDC-004-JO", status: "CONFIRMED" as BookingStatus },
    { room: sandtonRooms[2], checkIn: d(3), nights: 3, source: "DIRECT" as BookingSource, guest: "Zanele Mahlangu", email: "zanele@email.com", status: "CONFIRMED" as BookingStatus },
    { room: sandtonRooms[3], checkIn: d(7), nights: 5, source: "AIRBNB" as BookingSource, guest: "Oliver Chen", extRef: "AIR-006-OLC", status: "CONFIRMED" as BookingStatus },

    // --- KALAHARI: Past bookings ---
    { room: kalahariRooms[0], checkIn: p(65), nights: 4, source: "DIRECT" as BookingSource, guest: "Robert & Lisa Botha", email: "rbotha@email.com", status: "CHECKED_OUT" as BookingStatus },
    { room: kalahariRooms[1], checkIn: p(60), nights: 3, source: "AIRBNB" as BookingSource, guest: "Emma Thompson", extRef: "AIR-007-EMT", status: "CHECKED_OUT" as BookingStatus },
    { room: kalahariRooms[2], checkIn: p(55), nights: 7, source: "DIRECT" as BookingSource, guest: "The Naidoo Family", email: "naidoo@email.com", status: "CHECKED_OUT" as BookingStatus },
    { room: kalahariRooms[0], checkIn: p(45), nights: 3, source: "BOOKING_COM" as BookingSource, guest: "Pierre Dupont", extRef: "BDC-005-PD", status: "CHECKED_OUT" as BookingStatus },
    { room: kalahariRooms[1], checkIn: p(35), nights: 5, source: "DIRECT" as BookingSource, guest: "Tumelo & Kefilwe", email: "tumelo@email.com", status: "CHECKED_OUT" as BookingStatus },
    { room: kalahariRooms[2], checkIn: p(25), nights: 4, source: "AIRBNB" as BookingSource, guest: "Michael Schmidt", extRef: "AIR-008-MSC", status: "CHECKED_OUT" as BookingStatus },
    // Cancellation
    { room: kalahariRooms[0], checkIn: p(30), nights: 3, source: "BOOKING_COM" as BookingSource, guest: "Emily Jones", extRef: "BDC-CAN-002", status: "CANCELLED" as BookingStatus },
    // Current / upcoming
    { room: kalahariRooms[1], checkIn: p(3), nights: 5, source: "DIRECT" as BookingSource, guest: "Lindiwe & Thabo", email: "lindiwe@email.com", status: "CHECKED_IN" as BookingStatus },
    { room: kalahariRooms[2], checkIn: d(2), nights: 7, source: "AIRBNB" as BookingSource, guest: "Hugo van der Berg", extRef: "AIR-009-HVB", status: "CONFIRMED" as BookingStatus },
    { room: kalahariRooms[0], checkIn: d(10), nights: 4, source: "DIRECT" as BookingSource, guest: "Precious Moyo", email: "precious@email.com", status: "CONFIRMED" as BookingStatus },
  ];

  const createdBookings: any[] = [];

  for (const b of bookingData) {
    const checkIn = b.checkIn;
    const checkOut = addDays(checkIn, b.nights);
    const isOTA = b.source === "AIRBNB" || b.source === "BOOKING_COM";
    const commissionRate = b.source === "AIRBNB" ? 0.03 : b.source === "BOOKING_COM" ? 0.15 : 0;
    const grossAmount = Number(b.room.baseRate) * b.nights;
    const otaCommission = Math.round(grossAmount * commissionRate * 100) / 100;
    const netAmount = grossAmount - otaCommission;
    const vatRate = 0.15;
    const vatAmount = Math.round((netAmount * vatRate) * 100) / 100;

    const booking = await prisma.booking.create({
      data: {
        propertyId: b.room.propertyId,
        roomId: b.room.id,
        source: b.source,
        guestName: b.guest,
        guestEmail: b.email,
        checkIn,
        checkOut,
        roomRate: b.room.baseRate,
        grossAmount,
        otaCommission,
        netAmount,
        vatRate,
        vatAmount,
        isVatInclusive: false,
        status: b.status,
        externalRef: b.extRef,
      },
    });
    createdBookings.push(booking);
  }

  console.log(`  ✓ Created ${createdBookings.length} bookings`);

  // ─────────────────────────────────────────────
  // TRANSACTIONS — Income from completed bookings
  // ─────────────────────────────────────────────
  console.log("💰 Creating transactions...");
  let txCount = 0;

  const completedBookings = createdBookings.filter(b => b.status === "CHECKED_OUT");

  for (const booking of completedBookings) {
    await prisma.transaction.create({
      data: {
        organisationId: org.id,
        propertyId: booking.propertyId,
        bookingId: booking.id,
        type: "INCOME",
        source: "BOOKING",
        category: "ACCOMMODATION",
        amount: booking.netAmount,
        currency: "ZAR",
        date: booking.checkOut,
        description: `Accommodation — ${booking.guestName}`,
        reference: `BK-${booking.id.slice(-6).toUpperCase()}`,
        vatRate: booking.vatRate,
        vatAmount: booking.vatAmount,
        isVatInclusive: false,
        status: "CLEARED",
      },
    });
    txCount++;

    // OTA commission expense
    if (Number(booking.otaCommission) > 0) {
      await prisma.transaction.create({
        data: {
          organisationId: org.id,
          propertyId: booking.propertyId,
          bookingId: booking.id,
          type: "EXPENSE",
          source: "BOOKING",
          category: "OTA_COMMISSION",
          amount: booking.otaCommission,
          currency: "ZAR",
          date: booking.checkOut,
          description: `OTA Commission — ${booking.source} — ${booking.guestName}`,
          reference: booking.externalRef,
          vatRate: 0,
          vatAmount: 0,
          isVatInclusive: false,
          status: "CLEARED",
        },
      });
      txCount++;
    }
  }

  // --- Operational Expenses: Sandton ---
  const sandtonExpenses = [
    { vendorId: vendorCleaning.id, deptKey: "sandton-housekeeping", amount: 8500, desc: "Monthly cleaning contract — February", days: 28 },
    { vendorId: vendorUtilities.id, deptKey: "sandton-front-office", amount: 3200, desc: "Electricity — February", days: 28 },
    { vendorId: vendorFood.id, deptKey: "sandton-food-n-beverage", amount: 4800, desc: "Breakfast supplies — February", days: 28 },
    { vendorId: vendorLinen.id, deptKey: "sandton-housekeeping", amount: 2100, desc: "Linen rental — February", days: 28 },
    { vendorId: vendorMaintenance.id, deptKey: "sandton-front-office", amount: 1450, desc: "Plumbing repair — Room 3", days: 45 },
    { vendorId: vendorCleaning.id, deptKey: "sandton-housekeeping", amount: 8500, desc: "Monthly cleaning contract — January", days: 55 },
    { vendorId: vendorUtilities.id, deptKey: "sandton-front-office", amount: 2950, desc: "Electricity — January", days: 55 },
    { vendorId: vendorFood.id, deptKey: "sandton-food-n-beverage", amount: 5200, desc: "Breakfast supplies — January", days: 55 },
  ];

  for (const e of sandtonExpenses) {
    const deptKey = `sandton-${e.deptKey.replace("sandton-", "")}`;
    const dept = depts[deptKey] || depts["sandton-front-office"];
    await prisma.transaction.create({
      data: {
        organisationId: org.id,
        propertyId: sandton.id,
        departmentId: dept?.id,
        vendorId: e.vendorId,
        type: "EXPENSE",
        source: "MANUAL",
        category: e.vendorId === vendorFood.id ? "FB" : e.vendorId === vendorCleaning.id || e.vendorId === vendorLinen.id ? "SUPPLIES" : e.vendorId === vendorUtilities.id ? "UTILITIES" : "MAINTENANCE",
        amount: e.amount,
        currency: "ZAR",
        date: subDays(today, e.days),
        description: e.desc,
        vatRate: 0.15,
        vatAmount: Math.round(e.amount * 0.15 * 100) / 100,
        isVatInclusive: true,
        status: "CLEARED",
      },
    });
    txCount++;
  }

  // --- Operational Expenses: Kalahari ---
  const kalahariExpenses = [
    { vendorId: vendorCleaning.id, amount: 6200, desc: "Monthly cleaning — February", days: 28 },
    { vendorId: vendorUtilities.id, amount: 4100, desc: "Solar + Generator fuel — February", days: 28 },
    { vendorId: vendorFood.id, amount: 9800, desc: "Full board food supplies — February", days: 28 },
    { vendorId: vendorMaintenance.id, amount: 3500, desc: "Chalet 2 roof repair", days: 35 },
    { vendorId: vendorLinen.id, amount: 1800, desc: "Linen rental — February", days: 28 },
  ];

  for (const e of kalahariExpenses) {
    await prisma.transaction.create({
      data: {
        organisationId: org.id,
        propertyId: kalahari.id,
        vendorId: e.vendorId,
        type: "EXPENSE",
        source: "MANUAL",
        category: e.vendorId === vendorFood.id ? "FB" : e.vendorId === vendorCleaning.id || e.vendorId === vendorLinen.id ? "SUPPLIES" : e.vendorId === vendorUtilities.id ? "UTILITIES" : "MAINTENANCE",
        amount: e.amount,
        currency: "ZAR",
        date: subDays(today, e.days),
        description: e.desc,
        vatRate: 0.15,
        vatAmount: Math.round(e.amount * 0.15 * 100) / 100,
        isVatInclusive: true,
        status: "CLEARED",
      },
    });
    txCount++;
  }

  console.log(`  ✓ Created ${txCount} transactions`);

  // ─────────────────────────────────────────────
  // INVOICES
  // ─────────────────────────────────────────────
  console.log("🧾 Creating invoices...");

  const invoiceData = [
    { booking: completedBookings[0], status: "PAID" as InvoiceStatus, days: 58 },
    { booking: completedBookings[1], status: "PAID" as InvoiceStatus, days: 55 },
    { booking: completedBookings[2], status: "PAID" as InvoiceStatus, days: 52 },
    { booking: completedBookings[3], status: "PAID" as InvoiceStatus, days: 45 },
    { booking: completedBookings[4], status: "PAID" as InvoiceStatus, days: 42 },
    { booking: completedBookings[5], status: "OVERDUE" as InvoiceStatus, days: 38 },
    { booking: completedBookings[6], status: "PAID" as InvoiceStatus, days: 32 },
    { booking: completedBookings[7], status: "SENT" as InvoiceStatus, days: 20 },
    { booking: completedBookings[8], status: "DRAFT" as InvoiceStatus, days: 10 },
    { booking: completedBookings[9], status: "PAID" as InvoiceStatus, days: 45 },
  ];

  const createdInvoices: any[] = [];
  for (let i = 0; i < invoiceData.length; i++) {
    const inv = invoiceData[i];
    const subtotal = Number(inv.booking.netAmount);
    const taxAmount = Math.round(subtotal * 0.15 * 100) / 100;
    const issueDate = subDays(today, inv.days);
    const invoice = await prisma.invoice.create({
      data: {
        organisationId: org.id,
        propertyId: inv.booking.propertyId,
        bookingId: inv.booking.id,
        invoiceNumber: `INV-${String(i + 1).padStart(5, "0")}`,
        issueDate,
        dueDate: addDays(issueDate, 7),
        subtotal,
        taxRate: 0.15,
        taxAmount,
        isTaxInclusive: false,
        totalAmount: subtotal + taxAmount,
        status: inv.status,
      },
    });
    createdInvoices.push(invoice);
  }

  // Receipts for PAID invoices
  const paidInvoices = createdInvoices.filter((_, i) => invoiceData[i].status === "PAID");
  const completedTxs = await prisma.transaction.findMany({
    where: { type: "INCOME", source: "BOOKING" },
    take: paidInvoices.length,
  });

  for (let i = 0; i < Math.min(paidInvoices.length, completedTxs.length); i++) {
    await prisma.receipt.create({
      data: {
        organisationId: org.id,
        transactionId: completedTxs[i].id,
        invoiceId: paidInvoices[i].id,
        amount: paidInvoices[i].totalAmount,
        paymentMethod: i % 3 === 0 ? "CASH" : i % 3 === 1 ? "CARD" : "EFT",
        date: addDays(paidInvoices[i].issueDate, 2),
        reference: `RCPT-${String(i + 1).padStart(4, "0")}`,
      },
    });
  }

  console.log(`  ✓ Created ${createdInvoices.length} invoices`);

  // ─────────────────────────────────────────────
  // OTA PAYOUTS
  // ─────────────────────────────────────────────
  console.log("💳 Creating OTA payouts...");

  const airbnbBookings = createdBookings.filter(b => b.source === "AIRBNB" && b.status === "CHECKED_OUT");
  const bdcBookings = createdBookings.filter(b => b.source === "BOOKING_COM" && b.status === "CHECKED_OUT");

  const airbnbGross = airbnbBookings.reduce((s, b) => s + Number(b.grossAmount), 0);
  const airbnbComm = airbnbBookings.reduce((s, b) => s + Number(b.otaCommission), 0);
  const airbnbNet = airbnbGross - airbnbComm;

  const airbnbPayout = await prisma.oTAPayout.create({
    data: {
      organisationId: org.id,
      propertyId: sandton.id,
      platform: "AIRBNB",
      periodStart: p(60),
      periodEnd: p(20),
      payoutDate: p(15),
      grossAmount: airbnbGross,
      totalCommission: airbnbComm,
      netAmount: airbnbNet,
      status: "RECONCILED",
      importFilename: "airbnb-payout-jan-feb-2026.csv",
    },
  });

  for (const b of airbnbBookings.slice(0, 5)) {
    await prisma.oTAPayoutItem.create({
      data: {
        payoutId: airbnbPayout.id,
        bookingId: b.id,
        externalBookingRef: b.externalRef || `AIR-UNKNOWN-${b.id.slice(-4)}`,
        guestName: b.guestName,
        checkIn: b.checkIn,
        checkOut: b.checkOut,
        grossAmount: b.grossAmount,
        commission: b.otaCommission,
        netAmount: b.netAmount,
        isMatched: true,
      },
    });
  }

  const bdcGross = bdcBookings.reduce((s, b) => s + Number(b.grossAmount), 0);
  const bdcComm = bdcBookings.reduce((s, b) => s + Number(b.otaCommission), 0);
  const bdcNet = bdcGross - bdcComm;

  const bdcPayout = await prisma.oTAPayout.create({
    data: {
      organisationId: org.id,
      propertyId: sandton.id,
      platform: "BOOKING_COM",
      periodStart: p(60),
      periodEnd: p(20),
      payoutDate: p(12),
      grossAmount: bdcGross,
      totalCommission: bdcComm,
      netAmount: bdcNet,
      status: "IMPORTED",
      importFilename: "booking-com-payout-jan-feb-2026.csv",
    },
  });

  for (const b of bdcBookings.slice(0, 4)) {
    await prisma.oTAPayoutItem.create({
      data: {
        payoutId: bdcPayout.id,
        bookingId: b.id,
        externalBookingRef: b.externalRef || `BDC-UNKNOWN-${b.id.slice(-4)}`,
        guestName: b.guestName,
        checkIn: b.checkIn,
        checkOut: b.checkOut,
        grossAmount: b.grossAmount,
        commission: b.otaCommission,
        netAmount: b.netAmount,
        isMatched: !!b.externalRef,
      },
    });
  }

  console.log("  ✓ Created 2 OTA payout batches");

  // ─────────────────────────────────────────────
  // BUDGET ITEMS
  // ─────────────────────────────────────────────
  console.log("📊 Creating budget items...");

  const currentPeriod = format(today, "yyyy-MM");
  const nextPeriod = format(addDays(today, 30), "yyyy-MM");

  const budgetCategories: { cat: any; sandton: number; kalahari: number }[] = [
    { cat: "ACCOMMODATION", sandton: 85000, kalahari: 60000 },
    { cat: "FB", sandton: 12000, kalahari: 25000 },
    { cat: "UTILITIES", sandton: 4000, kalahari: 5000 },
    { cat: "SUPPLIES", sandton: 8000, kalahari: 9000 },
    { cat: "MAINTENANCE", sandton: 3000, kalahari: 4000 },
    { cat: "SALARIES", sandton: 35000, kalahari: 28000 },
    { cat: "MARKETING", sandton: 5000, kalahari: 3000 },
  ];

  for (const period of [currentPeriod, nextPeriod]) {
    for (const item of budgetCategories) {
      await prisma.budgetItem.createMany({
        data: [
          { propertyId: sandton.id, category: item.cat, period, budgetedAmount: item.sandton },
          { propertyId: kalahari.id, category: item.cat, period, budgetedAmount: item.kalahari },
        ],
      });
    }
  }

  console.log("  ✓ Created budget items for current and next month");

  // ─────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────
  console.log("\n✅ Seed complete!\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📌 Login credentials:");
  console.log("   Email:    lebs@sunsethospitality.co.za");
  console.log("   Password: MrMoney2025!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
