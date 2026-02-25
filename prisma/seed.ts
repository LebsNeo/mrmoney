/**
 * MrMoney — Phase 1 Seed Script
 * Realistic hospitality sample data
 * Run: npx prisma db seed
 */

import "dotenv/config";
import { PrismaClient, BookingStatus, BookingSource, TransactionType, TransactionSource, TransactionCategory, TransactionStatus, InvoiceStatus, PaymentMethod, OTAPlatform, OTAPayoutStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { addDays, subDays, format, startOfMonth, endOfMonth } from "date-fns";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding MrMoney database...");

  // ─────────────────────────────────────────────
  // CLEANUP (idempotent)
  // ─────────────────────────────────────────────
  await prisma.budgetItem.deleteMany();
  await prisma.oTAPayoutItem.deleteMany();
  await prisma.oTAPayout.deleteMany();
  await prisma.receipt.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.department.deleteMany();
  await prisma.room.deleteMany();
  await prisma.property.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organisation.deleteMany();

  console.log("✓ Cleaned up existing data");

  // ─────────────────────────────────────────────
  // ORGANISATION
  // ─────────────────────────────────────────────
  const org = await prisma.organisation.create({
    data: {
      name: "Sunset Hospitality Group",
      slug: "sunset-hospitality",
      plan: "PRO",
      currency: "ZAR",
      vatRegistered: true,
      vatNumber: "4850123456",
      defaultVatRate: 0.15,
    },
  });
  console.log(`✓ Organisation: ${org.name}`);

  // ─────────────────────────────────────────────
  // USERS
  // ─────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("MrMoney2025!", 12);

  const owner = await prisma.user.create({
    data: {
      organisationId: org.id,
      email: "lebs@sunsethospitality.co.za",
      name: "Lebohang Neo",
      passwordHash,
      role: "OWNER",
      isActive: true,
    },
  });
  console.log(`✓ User: ${owner.email}`);

  // ─────────────────────────────────────────────
  // PROPERTIES
  // ─────────────────────────────────────────────
  const sandton = await prisma.property.create({
    data: {
      organisationId: org.id,
      name: "Sunset Guesthouse Sandton",
      type: "GUESTHOUSE",
      address: "12 Rivonia Road, Sandton",
      city: "Johannesburg",
      country: "ZA",
      timezone: "Africa/Johannesburg",
      currency: "ZAR",
      isActive: true,
    },
  });

  const kalahari = await prisma.property.create({
    data: {
      organisationId: org.id,
      name: "Kalahari Bush Lodge",
      type: "LODGE",
      address: "R31 Route, Kuruman",
      city: "Kuruman",
      country: "ZA",
      timezone: "Africa/Johannesburg",
      currency: "ZAR",
      isActive: true,
    },
  });
  console.log(`✓ Properties: ${sandton.name}, ${kalahari.name}`);

  // ─────────────────────────────────────────────
  // ROOMS — Sandton (5 rooms)
  // ─────────────────────────────────────────────
  const sandtonRooms = await Promise.all([
    prisma.room.create({ data: { propertyId: sandton.id, name: "Room 1 — Standard Single", type: "SINGLE", baseRate: 850.00, maxOccupancy: 1, status: "ACTIVE" } }),
    prisma.room.create({ data: { propertyId: sandton.id, name: "Room 2 — Standard Double", type: "DOUBLE", baseRate: 1200.00, maxOccupancy: 2, status: "ACTIVE" } }),
    prisma.room.create({ data: { propertyId: sandton.id, name: "Room 3 — Deluxe Double", type: "DOUBLE", baseRate: 1450.00, maxOccupancy: 2, status: "ACTIVE" } }),
    prisma.room.create({ data: { propertyId: sandton.id, name: "Room 4 — Queen Room", type: "QUEEN", baseRate: 1650.00, maxOccupancy: 2, status: "ACTIVE" } }),
    prisma.room.create({ data: { propertyId: sandton.id, name: "Room 5 — Executive Suite", type: "SUITE", baseRate: 2800.00, maxOccupancy: 3, status: "ACTIVE" } }),
  ]);

  // ROOMS — Kalahari (3 rooms)
  const kalahariRooms = await Promise.all([
    prisma.room.create({ data: { propertyId: kalahari.id, name: "Thorn Tree Chalet", type: "DOUBLE", baseRate: 1800.00, maxOccupancy: 2, status: "ACTIVE" } }),
    prisma.room.create({ data: { propertyId: kalahari.id, name: "Sunset King Chalet", type: "KING", baseRate: 2200.00, maxOccupancy: 2, status: "ACTIVE" } }),
    prisma.room.create({ data: { propertyId: kalahari.id, name: "Safari Suite", type: "SUITE", baseRate: 3500.00, maxOccupancy: 4, status: "ACTIVE" } }),
  ]);
  console.log(`✓ Rooms: ${sandtonRooms.length} Sandton + ${kalahariRooms.length} Kalahari`);

  // ─────────────────────────────────────────────
  // DEPARTMENTS
  // ─────────────────────────────────────────────
  const deptNames = ["Front Office", "Food & Beverage", "Housekeeping"];

  const sandtonDepts = await Promise.all(
    deptNames.map((name) => prisma.department.create({ data: { propertyId: sandton.id, name } }))
  );
  const kalahariDepts = await Promise.all(
    deptNames.map((name) => prisma.department.create({ data: { propertyId: kalahari.id, name } }))
  );
  console.log(`✓ Departments: ${sandtonDepts.length + kalahariDepts.length} total`);

  // ─────────────────────────────────────────────
  // VENDORS
  // ─────────────────────────────────────────────
  const vendors = await Promise.all([
    prisma.vendor.create({ data: { organisationId: org.id, name: "Fresh & Fine Produce", category: "FOOD", contactName: "Sipho Dlamini", email: "sipho@freshfine.co.za", phone: "011 234 5678" } }),
    prisma.vendor.create({ data: { organisationId: org.id, name: "CleanPro Services", category: "CLEANING", contactName: "Maria Santos", email: "maria@cleanpro.co.za", phone: "011 876 5432" } }),
    prisma.vendor.create({ data: { organisationId: org.id, name: "City Power Jhb", category: "UTILITIES", contactName: "Accounts Dept", email: "accounts@citypower.co.za" } }),
    prisma.vendor.create({ data: { organisationId: org.id, name: "FixIt Maintenance", category: "MAINTENANCE", contactName: "Thabo Mokoena", email: "thabo@fixit.co.za", phone: "082 345 6789" } }),
    prisma.vendor.create({ data: { organisationId: org.id, name: "LinenPlus Hospitality", category: "LINEN", contactName: "Zanele Khumalo", email: "zanele@linenplus.co.za", phone: "011 456 7890" } }),
  ]);
  console.log(`✓ Vendors: ${vendors.length}`);

  const [foodVendor, cleanVendor, utilVendor, maintVendor, linenVendor] = vendors;

  // ─────────────────────────────────────────────
  // BOOKINGS — 40 bookings over 90 days
  // ─────────────────────────────────────────────
  const today = new Date();
  const allRooms = [...sandtonRooms, ...kalahariRooms];

  const bookingDefs = [
    // Past bookings (checked out)
    { room: sandtonRooms[0], checkIn: subDays(today, 80), nights: 2, source: "AIRBNB" as BookingSource, status: "CHECKED_OUT" as BookingStatus, guest: "James Khumalo", commission: 0.15 },
    { room: sandtonRooms[1], checkIn: subDays(today, 78), nights: 3, source: "BOOKING_COM" as BookingSource, status: "CHECKED_OUT" as BookingStatus, guest: "Sarah van der Berg", commission: 0.18 },
    { room: sandtonRooms[2], checkIn: subDays(today, 75), nights: 2, source: "DIRECT" as BookingSource, status: "CHECKED_OUT" as BookingStatus, guest: "Peter Nkosi", commission: 0 },
    { room: sandtonRooms[3], checkIn: subDays(today, 73), nights: 4, source: "AIRBNB" as BookingSource, status: "CHECKED_OUT" as BookingStatus, guest: "Amahle Zulu", commission: 0.15 },
    { room: sandtonRooms[4], checkIn: subDays(today, 70), nights: 2, source: "DIRECT" as BookingSource, status: "CHECKED_OUT" as BookingStatus, guest: "Mark Thompson", commission: 0 },
    { room: kalahariRooms[0], checkIn: subDays(today, 68), nights: 3, source: "BOOKING_COM" as BookingSource, status: "CHECKED_OUT" as BookingStatus, guest: "Lebo Molefe", commission: 0.18 },
    { room: kalahariRooms[1], checkIn: subDays(today, 65), nights: 5, source: "AIRBNB" as BookingSource, status: "CHECKED_OUT" as BookingStatus, guest: "Johan Pretorius", commission: 0.15 },
    { room: kalahariRooms[2], checkIn: subDays(today, 62), nights: 2, source: "DIRECT" as BookingSource, status: "CHECKED_OUT" as BookingStatus, guest: "Nomsa Sithole", commission: 0 },
    { room: sandtonRooms[0], checkIn: subDays(today, 60), nights: 1, source: "WALKIN" as BookingSource, status: "CHECKED_OUT" as BookingStatus, guest: "Walk-In Guest", commission: 0 },
    { room: sandtonRooms[1], checkIn: subDays(today, 58), nights: 3, source: "BOOKING_COM" as BookingSource, status: "CHECKED_OUT" as BookingStatus, guest: "Thandi Dube", commission: 0.18 },
    { room: sandtonRooms[2], checkIn: subDays(today, 55), nights: 2, source: "AIRBNB" as BookingSource, status: "CHECKED_OUT" as BookingStatus, guest: "Chris Muller", commission: 0.15 },
    { room: sandtonRooms[3], checkIn: subDays(today, 53), nights: 3, source: "DIRECT" as BookingSource, status: "CHECKED_OUT" as BookingStatus, guest: "Fatima Osman", commission: 0 },
    { room: sandtonRooms[4], checkIn: subDays(today, 50), nights: 2, source: "AIRBNB" as BookingSource, status: "CHECKED_OUT" as BookingStatus, guest: "David Chen", commission: 0.15 },
    { room: kalahariRooms[0], checkIn: subDays(today, 48), nights: 4, source: "DIRECT" as BookingSource, status: "CHECKED_OUT" as BookingStatus, guest: "Nandi Mthembu", commission: 0 },
    { room: kalahariRooms[1], checkIn: subDays(today, 44), nights: 2, source: "BOOKING_COM" as BookingSource, status: "CHECKED_OUT" as BookingStatus, guest: "Adam Foster", commission: 0.18 },
    { room: kalahariRooms[2], checkIn: subDays(today, 42), nights: 3, source: "AIRBNB" as BookingSource, status: "CHECKED_OUT" as BookingStatus, guest: "Zanele Ndlovu", commission: 0.15 },
    { room: sandtonRooms[0], checkIn: subDays(today, 40), nights: 2, source: "DIRECT" as BookingSource, status: "CHECKED_OUT" as BookingStatus, guest: "Robert Smit", commission: 0 },
    { room: sandtonRooms[1], checkIn: subDays(today, 38), nights: 1, source: "BOOKING_COM" as BookingSource, status: "CANCELLED" as BookingStatus, guest: "Lisa Martin", commission: 0.18 },
    { room: sandtonRooms[2], checkIn: subDays(today, 35), nights: 3, source: "AIRBNB" as BookingSource, status: "CHECKED_OUT" as BookingStatus, guest: "Michael Brown", commission: 0.15 },
    { room: sandtonRooms[3], checkIn: subDays(today, 32), nights: 2, source: "DIRECT" as BookingSource, status: "CHECKED_OUT" as BookingStatus, guest: "Priya Naidoo", commission: 0 },
    { room: sandtonRooms[4], checkIn: subDays(today, 30), nights: 4, source: "BOOKING_COM" as BookingSource, status: "CHECKED_OUT" as BookingStatus, guest: "Gerhard Botha", commission: 0.18 },
    { room: kalahariRooms[0], checkIn: subDays(today, 28), nights: 2, source: "AIRBNB" as BookingSource, status: "CHECKED_OUT" as BookingStatus, guest: "Susan Jacobs", commission: 0.15 },
    { room: kalahariRooms[1], checkIn: subDays(today, 25), nights: 3, source: "DIRECT" as BookingSource, status: "CHECKED_OUT" as BookingStatus, guest: "Tebogo Mphela", commission: 0 },
    { room: kalahariRooms[2], checkIn: subDays(today, 22), nights: 2, source: "BOOKING_COM" as BookingSource, status: "CHECKED_OUT" as BookingStatus, guest: "Karen Williams", commission: 0.18 },
    { room: sandtonRooms[0], checkIn: subDays(today, 20), nights: 1, source: "WALKIN" as BookingSource, status: "NO_SHOW" as BookingStatus, guest: "Unknown Guest", commission: 0 },
    { room: sandtonRooms[1], checkIn: subDays(today, 18), nights: 2, source: "AIRBNB" as BookingSource, status: "CHECKED_OUT" as BookingStatus, guest: "Oluwaseun Adeyemi", commission: 0.15 },
    { room: sandtonRooms[2], checkIn: subDays(today, 15), nights: 3, source: "DIRECT" as BookingSource, status: "CHECKED_OUT" as BookingStatus, guest: "Francois du Plessis", commission: 0 },
    { room: sandtonRooms[3], checkIn: subDays(today, 12), nights: 2, source: "BOOKING_COM" as BookingSource, status: "CHECKED_OUT" as BookingStatus, guest: "Ayesha Cassim", commission: 0.18 },
    { room: sandtonRooms[4], checkIn: subDays(today, 10), nights: 3, source: "AIRBNB" as BookingSource, status: "CHECKED_OUT" as BookingStatus, guest: "Siphiwe Mahlangu", commission: 0.15 },
    { room: kalahariRooms[0], checkIn: subDays(today, 8), nights: 2, source: "DIRECT" as BookingSource, status: "CHECKED_OUT" as BookingStatus, guest: "Nina Kok", commission: 0 },
    // Current / upcoming bookings
    { room: sandtonRooms[0], checkIn: subDays(today, 1), nights: 3, source: "BOOKING_COM" as BookingSource, status: "CHECKED_IN" as BookingStatus, guest: "Kagiso Sithole", commission: 0.18 },
    { room: sandtonRooms[2], checkIn: today, nights: 2, source: "AIRBNB" as BookingSource, status: "CHECKED_IN" as BookingStatus, guest: "Daniel Ferreira", commission: 0.15 },
    { room: kalahariRooms[1], checkIn: today, nights: 4, source: "DIRECT" as BookingSource, status: "CONFIRMED" as BookingStatus, guest: "Grace Moagi", commission: 0 },
    { room: sandtonRooms[1], checkIn: addDays(today, 3), nights: 2, source: "AIRBNB" as BookingSource, status: "CONFIRMED" as BookingStatus, guest: "Siphamandla Ntuli", commission: 0.15 },
    { room: sandtonRooms[4], checkIn: addDays(today, 5), nights: 3, source: "DIRECT" as BookingSource, status: "CONFIRMED" as BookingStatus, guest: "Monica Steyn", commission: 0 },
    { room: kalahariRooms[2], checkIn: addDays(today, 7), nights: 5, source: "BOOKING_COM" as BookingSource, status: "CONFIRMED" as BookingStatus, guest: "Ethan Khoury", commission: 0.18 },
    { room: sandtonRooms[3], checkIn: addDays(today, 10), nights: 2, source: "AIRBNB" as BookingSource, status: "CONFIRMED" as BookingStatus, guest: "Naledi Phiri", commission: 0.15 },
    { room: kalahariRooms[0], checkIn: addDays(today, 14), nights: 3, source: "DIRECT" as BookingSource, status: "CONFIRMED" as BookingStatus, guest: "Ben Swanepoel", commission: 0 },
    { room: sandtonRooms[0], checkIn: addDays(today, 18), nights: 2, source: "BOOKING_COM" as BookingSource, status: "CONFIRMED" as BookingStatus, guest: "Yetunde Bakare", commission: 0.18 },
    { room: sandtonRooms[2], checkIn: addDays(today, 22), nights: 4, source: "AIRBNB" as BookingSource, status: "CONFIRMED" as BookingStatus, guest: "Ruan van Wyk", commission: 0.15 },
  ];

  const bookings = [];
  for (const def of bookingDefs) {
    const checkIn = def.checkIn;
    const checkOut = addDays(checkIn, def.nights);
    const roomRate = Number(def.room.baseRate);
    const grossAmount = roomRate * def.nights;
    const otaCommission = grossAmount * def.commission;
    const netAmount = grossAmount - otaCommission;
    const vatRate = 0.15;
    const vatAmount = netAmount * vatRate / (1 + vatRate); // VAT inclusive

    const booking = await prisma.booking.create({
      data: {
        propertyId: def.room.propertyId,
        roomId: def.room.id,
        source: def.source,
        guestName: def.guest,
        checkIn,
        checkOut,
        roomRate,
        grossAmount,
        otaCommission,
        netAmount,
        vatRate,
        vatAmount,
        isVatInclusive: true,
        status: def.status,
        externalRef: def.source !== "DIRECT" && def.source !== "WALKIN"
          ? `${def.source.replace("_", "")}-${Math.floor(Math.random() * 900000) + 100000}`
          : null,
      },
    });
    bookings.push(booking);
  }
  console.log(`✓ Bookings: ${bookings.length}`);

  // ─────────────────────────────────────────────
  // TRANSACTIONS — income from checked-out bookings
  // ─────────────────────────────────────────────
  const completedBookings = bookings.filter(
    (b) => b.status === "CHECKED_OUT"
  );

  for (const booking of completedBookings) {
    await prisma.transaction.create({
      data: {
        organisationId: org.id,
        propertyId: booking.propertyId,
        bookingId: booking.id,
        type: "INCOME",
        source: booking.source === "DIRECT" || booking.source === "WALKIN" ? "BOOKING" : "OTA_IMPORT",
        category: "ACCOMMODATION",
        amount: Number(booking.netAmount),
        currency: "ZAR",
        date: booking.checkOut,
        description: `Accommodation — ${booking.guestName}`,
        reference: booking.externalRef ?? `DIRECT-${booking.id.slice(0, 8)}`,
        vatRate: Number(booking.vatRate),
        vatAmount: Number(booking.vatAmount),
        isVatInclusive: true,
        status: "CLEARED",
      },
    });
  }

  // ─────────────────────────────────────────────
  // TRANSACTIONS — expenses (past 90 days)
  // ─────────────────────────────────────────────
  const expenseDefs = [
    // Sandton expenses
    { prop: sandton, dept: sandtonDepts[2], vendor: cleanVendor, cat: "LAUNDRY" as TransactionCategory, amount: 3200, desc: "Monthly linen service", daysAgo: 85 },
    { prop: sandton, dept: sandtonDepts[0], vendor: utilVendor, cat: "UTILITIES" as TransactionCategory, amount: 8500, desc: "Electricity — January", daysAgo: 82 },
    { prop: sandton, dept: sandtonDepts[1], vendor: foodVendor, cat: "FB" as TransactionCategory, amount: 4800, desc: "Breakfast stock purchase", daysAgo: 80 },
    { prop: sandton, dept: sandtonDepts[2], vendor: linenVendor, cat: "SUPPLIES" as TransactionCategory, amount: 2100, desc: "New linen & towels", daysAgo: 75 },
    { prop: sandton, dept: sandtonDepts[0], vendor: maintVendor, cat: "MAINTENANCE" as TransactionCategory, amount: 1800, desc: "Geyser repair — Room 3", daysAgo: 70 },
    { prop: sandton, dept: sandtonDepts[1], vendor: foodVendor, cat: "FB" as TransactionCategory, amount: 5200, desc: "Breakfast & beverages stock", daysAgo: 60 },
    { prop: sandton, dept: sandtonDepts[0], vendor: utilVendor, cat: "UTILITIES" as TransactionCategory, amount: 8200, desc: "Electricity — February", daysAgo: 52 },
    { prop: sandton, dept: sandtonDepts[2], vendor: cleanVendor, cat: "CLEANING" as TransactionCategory, amount: 6400, desc: "Cleaning services — Feb", daysAgo: 45 },
    { prop: sandton, dept: sandtonDepts[0], vendor: maintVendor, cat: "MAINTENANCE" as TransactionCategory, amount: 950, desc: "Plumbing — bathroom fix", daysAgo: 40 },
    { prop: sandton, dept: sandtonDepts[1], vendor: foodVendor, cat: "FB" as TransactionCategory, amount: 4600, desc: "Breakfast restocking", daysAgo: 30 },
    { prop: sandton, dept: sandtonDepts[0], vendor: utilVendor, cat: "UTILITIES" as TransactionCategory, amount: 8800, desc: "Electricity — March", daysAgo: 22 },
    { prop: sandton, dept: sandtonDepts[2], vendor: cleanVendor, cat: "LAUNDRY" as TransactionCategory, amount: 3400, desc: "Linen service — March", daysAgo: 15 },
    { prop: sandton, dept: sandtonDepts[0], vendor: null, cat: "SALARIES" as TransactionCategory, amount: 18500, desc: "Staff salaries — January", daysAgo: 88 },
    { prop: sandton, dept: sandtonDepts[0], vendor: null, cat: "SALARIES" as TransactionCategory, amount: 18500, desc: "Staff salaries — February", daysAgo: 58 },
    { prop: sandton, dept: sandtonDepts[0], vendor: null, cat: "SALARIES" as TransactionCategory, amount: 18500, desc: "Staff salaries — March", daysAgo: 28 },
    { prop: sandton, dept: sandtonDepts[0], vendor: null, cat: "MARKETING" as TransactionCategory, amount: 2500, desc: "Social media advertising", daysAgo: 35 },
    // Kalahari expenses
    { prop: kalahari, dept: kalahariDepts[2], vendor: cleanVendor, cat: "CLEANING" as TransactionCategory, amount: 4200, desc: "Deep cleaning service", daysAgo: 82 },
    { prop: kalahari, dept: kalahariDepts[0], vendor: utilVendor, cat: "UTILITIES" as TransactionCategory, amount: 6800, desc: "Electricity & water — Jan", daysAgo: 80 },
    { prop: kalahari, dept: kalahariDepts[1], vendor: foodVendor, cat: "FB" as TransactionCategory, amount: 7200, desc: "Lodge kitchen supplies", daysAgo: 75 },
    { prop: kalahari, dept: kalahariDepts[2], vendor: linenVendor, cat: "SUPPLIES" as TransactionCategory, amount: 3600, desc: "Lodge bedding & towels", daysAgo: 68 },
    { prop: kalahari, dept: kalahariDepts[0], vendor: maintVendor, cat: "MAINTENANCE" as TransactionCategory, amount: 5400, desc: "Generator service", daysAgo: 55 },
    { prop: kalahari, dept: kalahariDepts[0], vendor: utilVendor, cat: "UTILITIES" as TransactionCategory, amount: 6600, desc: "Electricity & water — Feb", daysAgo: 50 },
    { prop: kalahari, dept: kalahariDepts[1], vendor: foodVendor, cat: "FB" as TransactionCategory, amount: 6800, desc: "Kitchen resupply", daysAgo: 42 },
    { prop: kalahari, dept: kalahariDepts[0], vendor: null, cat: "SALARIES" as TransactionCategory, amount: 22000, desc: "Staff salaries — January", daysAgo: 88 },
    { prop: kalahari, dept: kalahariDepts[0], vendor: null, cat: "SALARIES" as TransactionCategory, amount: 22000, desc: "Staff salaries — February", daysAgo: 58 },
    { prop: kalahari, dept: kalahariDepts[0], vendor: null, cat: "SALARIES" as TransactionCategory, amount: 22000, desc: "Staff salaries — March", daysAgo: 28 },
    { prop: kalahari, dept: kalahariDepts[0], vendor: utilVendor, cat: "UTILITIES" as TransactionCategory, amount: 7100, desc: "Electricity & water — March", daysAgo: 20 },
    { prop: kalahari, dept: kalahariDepts[2], vendor: cleanVendor, cat: "LAUNDRY" as TransactionCategory, amount: 4400, desc: "Lodge laundry service", daysAgo: 12 },
  ];

  for (const def of expenseDefs) {
    await prisma.transaction.create({
      data: {
        organisationId: org.id,
        propertyId: def.prop.id,
        departmentId: def.dept.id,
        vendorId: def.vendor?.id ?? null,
        type: "EXPENSE",
        source: "MANUAL",
        category: def.cat,
        amount: def.amount,
        currency: "ZAR",
        date: subDays(today, def.daysAgo),
        description: def.desc,
        vatRate: 0.15,
        vatAmount: def.amount * 0.15 / 1.15,
        isVatInclusive: true,
        status: "CLEARED",
      },
    });
  }
  console.log(`✓ Transactions: ${completedBookings.length} income + ${expenseDefs.length} expenses`);

  // ─────────────────────────────────────────────
  // INVOICES (10 — mix of statuses)
  // ─────────────────────────────────────────────
  const invoiceDefs = [
    { prop: sandton, booking: bookings[0], status: "PAID" as InvoiceStatus, amount: Number(bookings[0].grossAmount), daysAgo: 78 },
    { prop: sandton, booking: bookings[1], status: "PAID" as InvoiceStatus, amount: Number(bookings[1].grossAmount), daysAgo: 75 },
    { prop: sandton, booking: bookings[2], status: "PAID" as InvoiceStatus, amount: Number(bookings[2].grossAmount), daysAgo: 72 },
    { prop: kalahari, booking: bookings[5], status: "PAID" as InvoiceStatus, amount: Number(bookings[5].grossAmount), daysAgo: 65 },
    { prop: kalahari, booking: bookings[6], status: "PAID" as InvoiceStatus, amount: Number(bookings[6].grossAmount), daysAgo: 60 },
    { prop: sandton, booking: bookings[10], status: "PAID" as InvoiceStatus, amount: Number(bookings[10].grossAmount), daysAgo: 52 },
    { prop: sandton, booking: bookings[18], status: "PAID" as InvoiceStatus, amount: Number(bookings[18].grossAmount), daysAgo: 32 },
    { prop: kalahari, booking: bookings[22], status: "PAID" as InvoiceStatus, amount: Number(bookings[22].grossAmount), daysAgo: 22 },
    { prop: sandton, booking: bookings[25], status: "OVERDUE" as InvoiceStatus, amount: Number(bookings[25].grossAmount), daysAgo: 15 },
    { prop: sandton, booking: bookings[27], status: "DRAFT" as InvoiceStatus, amount: Number(bookings[27].grossAmount), daysAgo: 5 },
  ];

  const invoices = [];
  for (let i = 0; i < invoiceDefs.length; i++) {
    const def = invoiceDefs[i];
    const subtotal = def.amount / 1.15;
    const taxAmount = def.amount - subtotal;

    const invoice = await prisma.invoice.create({
      data: {
        organisationId: org.id,
        propertyId: def.prop.id,
        bookingId: def.booking.id,
        invoiceNumber: `INV-${String(i + 1).padStart(5, "0")}`,
        issueDate: subDays(today, def.daysAgo),
        dueDate: subDays(today, def.daysAgo - 14),
        subtotal,
        taxRate: 0.15,
        taxAmount,
        isTaxInclusive: true,
        totalAmount: def.amount,
        status: def.status,
      },
    });
    invoices.push(invoice);

    // Add receipt for paid invoices
    if (def.status === "PAID") {
      const txn = await prisma.transaction.create({
        data: {
          organisationId: org.id,
          propertyId: def.prop.id,
          bookingId: def.booking.id,
          invoiceId: invoice.id,
          type: "INCOME",
          source: "BOOKING",
          category: "ACCOMMODATION",
          amount: def.amount,
          currency: "ZAR",
          date: subDays(today, def.daysAgo),
          description: `Payment for ${invoice.invoiceNumber}`,
          vatRate: 0.15,
          vatAmount: taxAmount,
          isVatInclusive: true,
          status: "RECONCILED",
        },
      });

      await prisma.receipt.create({
        data: {
          organisationId: org.id,
          transactionId: txn.id,
          invoiceId: invoice.id,
          amount: def.amount,
          paymentMethod: def.booking.source === "DIRECT" || def.booking.source === "WALKIN"
            ? "EFT" as PaymentMethod
            : "OTA_PAYOUT" as PaymentMethod,
          date: subDays(today, def.daysAgo),
          reference: invoice.invoiceNumber,
        },
      });
    }
  }
  console.log(`✓ Invoices: ${invoices.length}`);

  // ─────────────────────────────────────────────
  // OTA PAYOUTS
  // ─────────────────────────────────────────────
  const airbnbBookings = bookings.filter(
    (b) => b.source === "AIRBNB" && b.status === "CHECKED_OUT"
  ).slice(0, 10);

  const airbnbPayout = await prisma.oTAPayout.create({
    data: {
      organisationId: org.id,
      propertyId: sandton.id,
      platform: "AIRBNB",
      periodStart: subDays(today, 60),
      periodEnd: subDays(today, 31),
      payoutDate: subDays(today, 28),
      grossAmount: airbnbBookings.reduce((s, b) => s + Number(b.grossAmount), 0),
      totalCommission: airbnbBookings.reduce((s, b) => s + Number(b.otaCommission), 0),
      netAmount: airbnbBookings.reduce((s, b) => s + Number(b.netAmount), 0),
      status: "RECONCILED",
      importFilename: "airbnb_payout_feb_2025.csv",
    },
  });

  for (const booking of airbnbBookings) {
    await prisma.oTAPayoutItem.create({
      data: {
        payoutId: airbnbPayout.id,
        bookingId: booking.id,
        externalBookingRef: booking.externalRef ?? `AIRBNB-${booking.id.slice(0, 8)}`,
        guestName: booking.guestName,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        grossAmount: Number(booking.grossAmount),
        commission: Number(booking.otaCommission),
        netAmount: Number(booking.netAmount),
        isMatched: true,
      },
    });
  }

  const bcomBookings = bookings.filter(
    (b) => b.source === "BOOKING_COM" && b.status === "CHECKED_OUT"
  ).slice(0, 8);

  const bcomPayout = await prisma.oTAPayout.create({
    data: {
      organisationId: org.id,
      propertyId: sandton.id,
      platform: "BOOKING_COM",
      periodStart: subDays(today, 60),
      periodEnd: subDays(today, 31),
      payoutDate: subDays(today, 25),
      grossAmount: bcomBookings.reduce((s, b) => s + Number(b.grossAmount), 0),
      totalCommission: bcomBookings.reduce((s, b) => s + Number(b.otaCommission), 0),
      netAmount: bcomBookings.reduce((s, b) => s + Number(b.netAmount), 0),
      status: "IMPORTED",
      importFilename: "booking_com_payout_feb_2025.csv",
    },
  });

  for (const booking of bcomBookings) {
    await prisma.oTAPayoutItem.create({
      data: {
        payoutId: bcomPayout.id,
        bookingId: booking.id,
        externalBookingRef: booking.externalRef ?? `BCOM-${booking.id.slice(0, 8)}`,
        guestName: booking.guestName,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        grossAmount: Number(booking.grossAmount),
        commission: Number(booking.otaCommission),
        netAmount: Number(booking.netAmount),
        isMatched: true,
      },
    });
  }
  console.log(`✓ OTA Payouts: Airbnb (${airbnbBookings.length} items) + Booking.com (${bcomBookings.length} items)`);

  // ─────────────────────────────────────────────
  // BUDGET ITEMS (current month)
  // ─────────────────────────────────────────────
  const currentPeriod = format(today, "yyyy-MM");
  const budgetDefs = [
    { prop: sandton, dept: sandtonDepts[0], cat: "ACCOMMODATION" as TransactionCategory, amount: 85000 },
    { prop: sandton, dept: sandtonDepts[1], cat: "FB" as TransactionCategory, amount: 12000 },
    { prop: sandton, dept: sandtonDepts[2], cat: "LAUNDRY" as TransactionCategory, amount: 4000 },
    { prop: sandton, dept: sandtonDepts[0], cat: "UTILITIES" as TransactionCategory, amount: 9000 },
    { prop: sandton, dept: sandtonDepts[0], cat: "SALARIES" as TransactionCategory, amount: 18500 },
    { prop: sandton, dept: sandtonDepts[0], cat: "MAINTENANCE" as TransactionCategory, amount: 3000 },
    { prop: kalahari, dept: kalahariDepts[0], cat: "ACCOMMODATION" as TransactionCategory, amount: 110000 },
    { prop: kalahari, dept: kalahariDepts[1], cat: "FB" as TransactionCategory, amount: 18000 },
    { prop: kalahari, dept: kalahariDepts[2], cat: "LAUNDRY" as TransactionCategory, amount: 5000 },
    { prop: kalahari, dept: kalahariDepts[0], cat: "UTILITIES" as TransactionCategory, amount: 7500 },
    { prop: kalahari, dept: kalahariDepts[0], cat: "SALARIES" as TransactionCategory, amount: 22000 },
    { prop: kalahari, dept: kalahariDepts[0], cat: "MAINTENANCE" as TransactionCategory, amount: 5000 },
  ];

  for (const def of budgetDefs) {
    await prisma.budgetItem.create({
      data: {
        propertyId: def.prop.id,
        departmentId: def.dept.id,
        category: def.cat,
        period: currentPeriod,
        budgetedAmount: def.amount,
      },
    });
  }
  console.log(`✓ Budget Items: ${budgetDefs.length} for ${currentPeriod}`);

  // ─────────────────────────────────────────────
  // DONE
  // ─────────────────────────────────────────────
  console.log("\n✅ MrMoney seed complete!");
  console.log(`   Organisation: ${org.name}`);
  console.log(`   Owner login:  lebs@sunsethospitality.co.za`);
  console.log(`   Password:     MrMoney2025!`);
  console.log(`   Properties:   2`);
  console.log(`   Rooms:        ${sandtonRooms.length + kalahariRooms.length}`);
  console.log(`   Bookings:     ${bookings.length}`);
  console.log(`   Vendors:      ${vendors.length}`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
