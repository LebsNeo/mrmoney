/**
 * Test script: parse real Capitec + Standard Bank CSVs and show results
 * Run: cd mrmoney && npx tsx scripts/test-bank-import.ts
 */
import { readFileSync } from "fs";
import * as dotenv from "dotenv";
dotenv.config();

import { parseBankStatementCSV } from "../src/lib/bank-import";

const GOLFBNB_PROP = "703782f5-df7c-4a24-a23f-3426fc434226";
const NELSBNB_PROP = "6a881b55-8018-4146-b37c-bb45143ae368";
const ORG_ID       = "5f33601d-cc1a-417f-a82d-f6f83782fc51";

async function run() {
  // ── CAPITEC ──────────────────────────────────────────────────────────────
  const capitecCSV = readFileSync(
    "/Users/zakes/.openclaw/media/inbound/CAPITEC_BUSINESS_FEB_2026---d676e25b-b66e-4138-96d4-e5b81f53a65a.csv",
    "utf-8"
  );
  const cap = await parseBankStatementCSV(capitecCSV, "CAPITEC", GOLFBNB_PROP, ORG_ID);
  const capIncome  = cap.transactions.filter(t => t.type === "INCOME").reduce((s,t) => s+t.amount, 0);
  const capExpense = cap.transactions.filter(t => t.type === "EXPENSE").reduce((s,t) => s+t.amount, 0);

  console.log("\n╔══ CAPITEC BUSINESS — Feb 2026 ══╗");
  console.log(`  Valid transactions : ${cap.transactions.length}`);
  console.log(`  Potential dupes    : ${cap.potentialDuplicates.length}`);
  console.log(`  Unrecognised rows  : ${cap.unrecognised.length}`);
  console.log(`  Total income       : R${capIncome.toFixed(2)}`);
  console.log(`  Total expenses     : R${capExpense.toFixed(2)}`);
  console.log("  Sample (first 5):");
  cap.transactions.slice(0, 5).forEach(t =>
    console.log(`    ${t.date.toISOString().slice(0,10)} | ${t.type.padEnd(7)} | R${t.amount.toFixed(2).padStart(9)} | ${t.category.padEnd(15)} | ${t.description.slice(0,45)}`)
  );

  // ── STANDARD BANK ────────────────────────────────────────────────────────
  const stdCSV = readFileSync(
    "/Users/zakes/.openclaw/media/inbound/standard_bank_business---34c4a8bf-b773-469f-bf30-934240e14652.csv",
    "utf-8"
  );
  const std = await parseBankStatementCSV(stdCSV, "STANDARD_BANK", NELSBNB_PROP, ORG_ID);
  const stdIncome  = std.transactions.filter(t => t.type === "INCOME").reduce((s,t) => s+t.amount, 0);
  const stdExpense = std.transactions.filter(t => t.type === "EXPENSE").reduce((s,t) => s+t.amount, 0);

  console.log("\n╔══ STANDARD BANK BUSINESS — Jan-Feb 2026 ══╗");
  console.log(`  Valid transactions : ${std.transactions.length}`);
  console.log(`  Potential dupes    : ${std.potentialDuplicates.length}`);
  console.log(`  Unrecognised rows  : ${std.unrecognised.length}`);
  console.log(`  Total income       : R${stdIncome.toFixed(2)}`);
  console.log(`  Total expenses     : R${stdExpense.toFixed(2)}`);
  console.log("  Sample (first 5):");
  std.transactions.slice(0, 5).forEach(t =>
    console.log(`    ${t.date.toISOString().slice(0,10)} | ${t.type.padEnd(7)} | R${t.amount.toFixed(2).padStart(9)} | ${t.category.padEnd(15)} | ${t.description.slice(0,45)}`)
  );

  console.log("\n✅ Both parsers working. Ready to import.\n");
}

run().catch(e => { console.error(e); process.exit(1); });
