/**
 * MrMoney — Real OTA Import Test
 * Runs all three parsers against the actual files received from Lebs
 * and saves to the GolfBnB org in the real DB.
 *
 * Run: npx tsx prisma/test-imports.ts
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
dotenv.config();
import * as fs from "fs";
import * as path from "path";

import {
  parseLekkerslaapCSV,
  parseBookingComCSV,
  parseAirbnbCSV,
  saveOTAPayoutsToDb,
} from "../src/lib/ota-import";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ─── GolfBnB real tenant IDs ───────────────────────────────────────────────
const ORG_ID      = "5f33601d-cc1a-417f-a82d-f6f83782fc51";
const GOLFBNB_ID  = "703782f5-df7c-4a24-a23f-3426fc434226";
const NELSBNB_ID  = "6a881b55-8018-4146-b37c-bb45143ae368";

// ─── Inbound files ──────────────────────────────────────────────────────────
const MEDIA = "/Users/zakes/.openclaw/media/inbound";

const FILES = {
  lekkerslaap: path.join(MEDIA, "LekkeSlaap_Statement_2026-01-02---f18e545f-daa4-4041-9408-553e8feaf2db.csv"),
  bookingCom:  path.join(MEDIA, "Payout_from_2025-11-01_until_2026-01-31_booking.com---ec7c18ff-f7da-4744-827c-ffc58fa13a3d.csv"),
  airbnb:      path.join(MEDIA, "airbnb-upcoming-all---1daa1f72-a95f-40e5-9817-a3110874efaa.csv"),
};

function sep(label: string) {
  console.log(`\n${"─".repeat(50)}`);
  console.log(`  ${label}`);
  console.log("─".repeat(50));
}

async function testLekkerslaap() {
  sep("1. LEKKERSLAAP → GolfBnB");
  const csv = fs.readFileSync(FILES.lekkerslaap, "utf8");
  const result = parseLekkerslaapCSV(csv);

  console.log(`  Parsed: ${result.bookingCount} bookings, ${result.payouts.length} payout batches`);
  console.log(`  Gross: R${result.totalGross.toFixed(2)}  |  Commission: R${result.totalCommission.toFixed(2)}  |  Net: R${result.totalNet.toFixed(2)}`);
  if (result.warnings.length) console.log(`  ⚠️  ${result.warnings.join(", ")}`);

  const save = await saveOTAPayoutsToDb(result, GOLFBNB_ID, ORG_ID, "LekkeSlaap_Statement_2026-01-02.csv");
  console.log(`  ✅ Saved: ${save.payoutsCreated} payouts, ${save.itemsCreated} items, ${save.itemsMatched} matched`);
  if (save.warnings.length) save.warnings.forEach(w => console.log(`  ⚠️  ${w}`));
}

async function testBookingCom() {
  sep("2. BOOKING.COM → NelsBNB");
  const csv = fs.readFileSync(FILES.bookingCom, "utf8");
  const result = parseBookingComCSV(csv);

  console.log(`  Parsed: ${result.bookingCount} bookings, ${result.payouts.length} payout batches`);
  console.log(`  Gross: R${result.totalGross.toFixed(2)}  |  Commission: R${result.totalCommission.toFixed(2)}  |  Net: R${result.totalNet.toFixed(2)}`);
  if (result.warnings.length) console.log(`  ⚠️  ${result.warnings.join(", ")}`);

  // Show per-payout summary
  for (const p of result.payouts) {
    const propNames = [...new Set(p.bookings.map(b => b.propertyName).filter(Boolean))];
    console.log(`  Batch ${p.batchRef}: R${p.payoutAmount.toFixed(2)} on ${p.payoutDate.toISOString().slice(0,10)} — ${p.bookings.length} bookings [${propNames.join(", ")}]`);
  }

  const save = await saveOTAPayoutsToDb(result, NELSBNB_ID, ORG_ID, "Booking.com_Payout_Nov2025-Jan2026.csv");
  console.log(`  ✅ Saved: ${save.payoutsCreated} payouts, ${save.itemsCreated} items, ${save.itemsMatched} matched`);
  if (save.warnings.length) save.warnings.forEach(w => console.log(`  ⚠️  ${w}`));
}

async function testAirbnb() {
  sep("3. AIRBNB → GolfBnB");
  const csv = fs.readFileSync(FILES.airbnb, "utf8");
  const result = parseAirbnbCSV(csv);

  console.log(`  Parsed: ${result.bookingCount} reservations, ${result.payouts.length} payout batches`);
  console.log(`  Gross: R${result.totalGross.toFixed(2)}  |  Commission: R${result.totalCommission.toFixed(2)}  |  Net: R${result.totalNet.toFixed(2)}`);
  if (result.warnings.length) console.log(`  ⚠️  ${result.warnings.join(", ")}`);

  for (const p of result.payouts) {
    console.log(`  Batch ${p.batchRef}: R${p.payoutAmount.toFixed(2)} — ${p.bookings.length} bookings`);
  }

  const save = await saveOTAPayoutsToDb(result, GOLFBNB_ID, ORG_ID, "airbnb-upcoming-all.csv");
  console.log(`  ✅ Saved: ${save.payoutsCreated} payouts, ${save.itemsCreated} items, ${save.itemsMatched} matched`);
  if (save.warnings.length) save.warnings.forEach(w => console.log(`  ⚠️  ${w}`));
}

async function verifyDB() {
  sep("4. DB VERIFICATION");
  const payouts = await prisma.oTAPayout.findMany({
    where: { organisationId: ORG_ID, deletedAt: null },
    include: { property: { select: { name: true } }, _count: { select: { items: true } } },
    orderBy: { payoutDate: "asc" },
  });

  console.log(`  Total payout batches for GolfBnB org: ${payouts.length}`);
  for (const p of payouts) {
    console.log(`  [${p.platform}] ${p.property.name} | ${p.payoutDate.toISOString().slice(0,10)} | R${Number(p.netAmount).toFixed(2)} net | ${p._count.items} items`);
  }
}

async function main() {
  console.log("🧪 MrMoney — Real OTA Import Test\n");

  await testLekkerslaap();
  await testBookingCom();
  await testAirbnb();
  await verifyDB();

  console.log("\n✅ All imports done. Check https://mrmoney.vercel.app/ota-payouts");
}

main()
  .catch(e => { console.error("❌ Error:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
