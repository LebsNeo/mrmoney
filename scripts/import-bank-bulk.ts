/**
 * Bulk bank import — no per-row DB calls, uses createMany
 * Parses inline without importing the singleton prisma from src/lib/prisma
 */
import { readFileSync } from "fs";
import { parse as parseDate, isValid } from "date-fns";
import * as dotenv from "dotenv";
dotenv.config();

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, TransactionSource, TransactionStatus, TransactionCategory, TransactionType } from "@prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const GOLFBNB_PROP = "703782f5-df7c-4a24-a23f-3426fc434226";
const NELSBNB_PROP = "6a881b55-8018-4146-b37c-bb45143ae368";
const ORG_ID       = "5f33601d-cc1a-417f-a82d-f6f83782fc51";

// ── Inline parsers (no DB dependency) ─────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let cur = "", inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; }
    else if (ch === ',' && !inQ) { fields.push(cur.trim()); cur = ""; }
    else { cur += ch; }
  }
  fields.push(cur.trim());
  return fields;
}

function safeDate(val: string, fmt: string): Date | null {
  const d = parseDate(val, fmt, new Date());
  return isValid(d) ? d : null;
}

function safeAmount(val: string): number | null {
  const s = val.replace(/[^0-9.\-]/g, "");
  if (!s || s === "-") return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function categorise(desc: string): TransactionCategory {
  const d = desc.toLowerCase();
  if (d.includes("salary") || d.includes("wage") || d.includes("tumisang") || d.includes("dimpho") || d.includes("mamello") || d.includes("housekeeping") || d.includes("house keeping")) return TransactionCategory.SALARIES;
  if (d.includes("google ads") || d.includes("marketing") || d.includes("nightsbridge") || d.includes("paystack")) return TransactionCategory.MARKETING;
  if (d.includes("internet") || d.includes("vox") || d.includes("switch tel") || d.includes("netcash") || d.includes("water") || d.includes("rates") || d.includes("electricity") || d.includes("mbombela") || d.includes("siluluanzi") || d.includes("service agreement")) return TransactionCategory.UTILITIES;
  if (d.includes("buco") || d.includes("makro") || d.includes("hardware") || d.includes("maintenance") || d.includes("repairs") || d.includes("regal") || d.includes("valueco") || d.includes("chain") || d.includes("crazy plastics") || d.includes("bwh")) return TransactionCategory.MAINTENANCE;
  if (d.includes("checkers") || d.includes("spar") || d.includes("food") || d.includes("grocery") || d.includes("pnp") || d.includes("continental")) return TransactionCategory.FB;
  if (d.includes("cleaning") || d.includes("laundry")) return TransactionCategory.CLEANING;
  if (d.includes("supplies") || d.includes("supply") || d.includes("stationery")) return TransactionCategory.SUPPLIES;
  // Income: OTA payouts and direct guest payments → ACCOMMODATION
  if (d.includes("lekkeslaap") || d.includes("booking") || d.includes("airbnb") || d.includes("eftpos settlement") || d.includes("pos settle") || d.includes("rtc deposit") || d.includes("payshap payment from") || d.includes("interbank credit") || d.includes("real time transfer from") || d.includes("cash deposit") || d.includes("magtape credit") || d.includes("autobank cash") || d.includes("inward eft") || d.includes("retail cr") || d.includes("credit transfer") || d.includes("transfer from") || d.includes("safari") || d.includes("accomod") || d.includes("guest")) return TransactionCategory.ACCOMMODATION;
  return TransactionCategory.OTHER;
}

function parseCapitec(csv: string) {
  const txns = [];
  const lines = csv.split(/\r?\n/).filter(l => l.trim());
  for (let i = 1; i < lines.length; i++) {
    const f = parseCSVLine(lines[i]);
    if (f.length < 5) continue;
    const date = safeDate(f[1]?.trim() ?? "", "dd/MM/yyyy");
    if (!date) continue;
    const amount = safeAmount(f[4] ?? "");
    if (amount === null) continue;
    const desc = (f[2] ?? "").trim();
    const ref = (f[3] ?? "").trim();
    txns.push({ date, description: ref ? `${desc} | ${ref}` : desc, amount });
  }
  return txns;
}

function parseStdBank(csv: string) {
  const txns = [];
  const lines = csv.split(/\r?\n/).filter(l => l.trim());
  for (let i = 1; i < lines.length; i++) {
    const f = parseCSVLine(lines[i]);
    if (f[0]?.trim() !== "HIST" || f.length < 5) continue;
    const date = safeDate(f[1]?.trim() ?? "", "yyyyMMdd");
    if (!date) continue;
    const amount = safeAmount(f[3] ?? "");
    if (amount === null) continue;
    const desc = (f[4] ?? "").trim();
    const ref = (f[5] ?? "").trim();
    const fullDesc = ref && !/^\d+$/.test(ref) ? `${desc} | ${ref}` : desc;
    txns.push({ date, description: fullDesc, amount });
  }
  return txns;
}

// ── Bulk DB import ─────────────────────────────────────────────────────────

async function bulkImport(
  txns: { date: Date; description: string; amount: number }[],
  propertyId: string,
  bankLabel: string
) {
  const rows = txns.map(tx => ({
    organisationId: ORG_ID,
    propertyId,
    type: (tx.amount >= 0 ? "INCOME" : "EXPENSE") as TransactionType,
    source: TransactionSource.CSV_IMPORT,
    category: categorise(tx.description),
    description: tx.description,
    amount: Math.abs(tx.amount),
    date: tx.date,
    status: TransactionStatus.CLEARED,
    reference: `${bankLabel}-${tx.date.toISOString().slice(0,10)}`,
    vatAmount: 0,
    vatRate: 0,
    isVatInclusive: false,
  }));

  const result = await prisma.transaction.createMany({ data: rows, skipDuplicates: false });
  const income  = txns.filter(t => t.amount >= 0).reduce((s,t) => s + t.amount, 0);
  const expense = txns.filter(t => t.amount < 0).reduce((s,t) => s + Math.abs(t.amount), 0);
  console.log(`  ✅ Created ${result.count} transactions`);
  console.log(`     Income: R${income.toFixed(2)} | Expenses: R${expense.toFixed(2)} | Net: R${(income-expense).toFixed(2)}`);
  return result.count;
}

async function main() {
  console.log("🏦 MrMoney Bulk Bank Import\n" + "═".repeat(40));

  console.log("\n📥 Capitec Business — GolfBnB...");
  const capTxns = parseCapitec(readFileSync(
    "/Users/zakes/.openclaw/media/inbound/CAPITEC_BUSINESS_FEB_2026---d676e25b-b66e-4138-96d4-e5b81f53a65a.csv", "utf-8"
  ));
  console.log(`   Parsed: ${capTxns.length} transactions`);
  const capCount = await bulkImport(capTxns, GOLFBNB_PROP, "CAPITEC");

  console.log("\n📥 Standard Bank Business — NelsBNB...");
  const stdTxns = parseStdBank(readFileSync(
    "/Users/zakes/.openclaw/media/inbound/standard_bank_business---34c4a8bf-b773-469f-bf30-934240e14652.csv", "utf-8"
  ));
  console.log(`   Parsed: ${stdTxns.length} transactions`);
  const stdCount = await bulkImport(stdTxns, NELSBNB_PROP, "STANDARD_BANK");

  const total = await prisma.transaction.count({ where: { organisationId: ORG_ID } });
  console.log("\n" + "═".repeat(40));
  console.log(`✅ Done! ${capCount + stdCount} transactions imported`);
  console.log(`   Total transactions in DB: ${total}`);
  console.log("═".repeat(40));
}

main()
  .catch(e => { console.error("❌", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
