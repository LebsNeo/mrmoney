/**
 * MrMoney — GolfBnB Go-Live Seed
 * Creates the real production tenant for Lebohang Neo.
 *
 * Safe to re-run: uses upsert throughout — won't duplicate records.
 * Does NOT touch the demo "Sunset Hospitality" tenant.
 *
 * Run: npm run seed:golfbnb
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, RoomType, RoomStatus, PropertyType } from "@prisma/client";
import * as dotenv from "dotenv";
dotenv.config();
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🏌️  Seeding GolfBnB go-live data...\n");

  // ─────────────────────────────────────────────
  // ORGANISATION
  // ─────────────────────────────────────────────
  console.log("📦 Organisation: GolfBnB...");
  const org = await prisma.organisation.upsert({
    where: { slug: "golfbnb" },
    update: { name: "GolfBnB" },
    create: {
      name: "GolfBnB",
      slug: "golfbnb",
      plan: "STARTER",
      currency: "ZAR",
      vatRegistered: false,
      defaultVatRate: 0.15,
    },
  });
  console.log(`   ✅ Org ID: ${org.id}`);

  // ─────────────────────────────────────────────
  // OWNER USER
  // ─────────────────────────────────────────────
  console.log("\n👤 User: Lebohang Neo (lebsneo@gmail.com)...");
  const passwordHash = await bcrypt.hash("MrMoney@2025", 12);
  const owner = await prisma.user.upsert({
    where: { email: "lebsneo@gmail.com" },
    update: { passwordHash, name: "Lebohang Neo", organisationId: org.id },
    create: {
      organisationId: org.id,
      email: "lebsneo@gmail.com",
      name: "Lebohang Neo",
      passwordHash,
      role: "OWNER",
      isActive: true,
    },
  });
  console.log(`   ✅ User ID: ${owner.id}`);

  // ─────────────────────────────────────────────
  // PROPERTY 1 — GOLFBNB
  // ─────────────────────────────────────────────
  console.log("\n🏠 Property: GolfBnB (3 Mandulia Street, West Acres, Mbombela)...");
  const golfbnb = await prisma.property.upsert({
    where: {
      // Composite uniqueness: org + name (no unique index — use findFirst + manual upsert)
      id: await getPropertyId(org.id, "GolfBnB"),
    },
    update: {
      address: "3 Mandulia Street, West Acres",
      city: "Mbombela",
      country: "ZA",
      isActive: true,
    },
    create: {
      organisationId: org.id,
      name: "GolfBnB",
      type: PropertyType.GUESTHOUSE,
      address: "3 Mandulia Street, West Acres",
      city: "Mbombela",
      country: "ZA",
      timezone: "Africa/Johannesburg",
      currency: "ZAR",
      isActive: true,
    },
  });
  console.log(`   ✅ Property ID: ${golfbnb.id}`);

  // ─────────────────────────────────────────────
  // ROOMS — GOLFBNB (8 rooms)
  // ─────────────────────────────────────────────
  console.log("\n🛏️  Rooms: GolfBnB (8 × en-suite double, R550/night)...");

  const golfbnbRooms = Array.from({ length: 8 }, (_, i) => ({
    name: `Room ${i + 1}`,
    description: "En-suite double bed",
    type: RoomType.DOUBLE as RoomType,
    baseRate: 550.00,
    maxOccupancy: 2,
    status: RoomStatus.ACTIVE as RoomStatus,
  }));

  for (const roomData of golfbnbRooms) {
    const existing = await prisma.room.findFirst({
      where: { propertyId: golfbnb.id, name: roomData.name, deletedAt: null },
    });
    if (!existing) {
      await prisma.room.create({
        data: {
          propertyId: golfbnb.id,
          ...roomData,
          baseRate: roomData.baseRate,
        },
      });
      console.log(`   ✅ Created ${roomData.name}`);
    } else {
      await prisma.room.update({
        where: { id: existing.id },
        data: {
          description: roomData.description,
          type: roomData.type,
          baseRate: roomData.baseRate,
          maxOccupancy: roomData.maxOccupancy,
          status: roomData.status,
        },
      });
      console.log(`   🔄 Updated ${roomData.name}`);
    }
  }

  // ─────────────────────────────────────────────
  // DEPARTMENTS — GOLFBNB
  // ─────────────────────────────────────────────
  console.log("\n🏷️  Departments: GolfBnB...");
  const golfDepts = ["Accommodation", "Maintenance", "Admin", "Food & Beverage"];
  for (const deptName of golfDepts) {
    const existing = await prisma.department.findFirst({
      where: { propertyId: golfbnb.id, name: deptName, deletedAt: null },
    });
    if (!existing) {
      await prisma.department.create({
        data: { propertyId: golfbnb.id, name: deptName },
      });
      console.log(`   ✅ ${deptName}`);
    } else {
      console.log(`   ⏭️  ${deptName} (exists)`);
    }
  }

  // ─────────────────────────────────────────────
  // PROPERTY 2 — NELSBNB
  // ─────────────────────────────────────────────
  console.log("\n🏠 Property: NelsBNB (formerly Nelsnest)...");
  const nelsbnb = await prisma.property.upsert({
    where: {
      id: await getPropertyId(org.id, "NelsBNB"),
    },
    update: {
      isActive: true,
    },
    create: {
      organisationId: org.id,
      name: "NelsBNB",
      type: PropertyType.GUESTHOUSE,
      city: "Mbombela",
      country: "ZA",
      timezone: "Africa/Johannesburg",
      currency: "ZAR",
      isActive: true,
    },
  });
  console.log(`   ✅ Property ID: ${nelsbnb.id}`);
  console.log("   ℹ️  NelsBNB rooms — add via dashboard (room count not specified)");

  // ─────────────────────────────────────────────
  // DEPARTMENTS — NELSBNB
  // ─────────────────────────────────────────────
  console.log("\n🏷️  Departments: NelsBNB...");
  const nelsDepts = ["Accommodation", "Maintenance", "Admin"];
  for (const deptName of nelsDepts) {
    const existing = await prisma.department.findFirst({
      where: { propertyId: nelsbnb.id, name: deptName, deletedAt: null },
    });
    if (!existing) {
      await prisma.department.create({
        data: { propertyId: nelsbnb.id, name: deptName },
      });
      console.log(`   ✅ ${deptName}`);
    } else {
      console.log(`   ⏭️  ${deptName} (exists)`);
    }
  }

  // ─────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────
  console.log("\n" + "═".repeat(50));
  console.log("✅ GolfBnB go-live seed complete!\n");
  console.log("🔐 Login:");
  console.log("   Email:    lebsneo@gmail.com");
  console.log("   Password: MrMoney@2025");
  console.log("   URL:      https://mrmoney.vercel.app\n");
  console.log("🏠 Properties created:");
  console.log(`   • GolfBnB  (${golfbnb.id})`);
  console.log(`   • NelsBNB  (${nelsbnb.id})`);
  console.log("\n💡 Demo tenant (Sunset Hospitality) is untouched.");
  console.log("   Login: lebs@sunsethospitality.co.za / MrMoney2025!");
  console.log("═".repeat(50));
}

// ─────────────────────────────────────────────
// Helper: get existing property ID or generate placeholder
// (Property has no unique(orgId, name) DB constraint — handle in code)
// ─────────────────────────────────────────────
async function getPropertyId(orgId: string, name: string): Promise<string> {
  const existing = await prisma.property.findFirst({
    where: { organisationId: orgId, name, deletedAt: null },
    select: { id: true },
  });
  // Return existing ID for upsert's where clause, or a dummy that won't match
  // (Prisma upsert requires the where field to be unique — we use id as the unique key)
  return existing?.id ?? "00000000-0000-0000-0000-000000000000";
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
