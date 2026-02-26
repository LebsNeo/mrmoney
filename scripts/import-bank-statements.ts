/**
 * Import real bank statements into MrMoney DB
 * Run: npx tsx --env-file=.env scripts/import-bank-statements.ts
 */
import { readFileSync } from "fs";
import * as dotenv from "dotenv";
dotenv.config();

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, TransactionType, TransactionSource, TransactionStatus } from "@prisma/client";
import { parseBankStatementCSV } from "../src/lib/bank-import";
import { logger } from "../src/lib/logger";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const GOLFBNB_PROP = "703782f5-df7c-4a24-a23f-3426fc434226";
const NELSBNB_PROP = "6a881b55-8018-4146-b37c-bb45143ae368";
const ORG_ID       = "5f33601d-cc1a-417f-a82d-f6f83782fc51";

async function importStatement(
  csvPath: string,
  bankFormat: string,
  propertyId: string,
  accountLabel: string
) {
  console.log(`\n📥 Importing ${bankFormat} → ${accountLabel}...`);
  const csvContent = readFileSync(csvPath, "utf-8");

  const result = await parseBankStatementCSV(csvContent, bankFormat, propertyId, ORG_ID);

  console.log(`   Parsed: ${result.transactions.length} valid | ${result.potentialDuplicates.length} dupes skipped | ${result.unrecognised.length} unrecognised`);

  let created = 0;
  for (const tx of result.transactions) {
    await prisma.transaction.create({
      data: {
        organisationId: ORG_ID,
        propertyId,
        type: tx.type as TransactionType,
        source: TransactionSource.BANK_IMPORT,
        category: tx.category,
        description: tx.description,
        amount: tx.amount,
        date: tx.date,
        status: TransactionStatus.CLEARED,
        reference: `${bankFormat}-IMPORT-${tx.date.toISOString().slice(0,10)}`,
        vatAmount: 0,
        vatRate: 0,
        isVatInclusive: false,
      },
    });
    created++;
  }

  const income  = result.transactions.filter(t => t.type === "INCOME").reduce((s,t) => s+t.amount, 0);
  const expense = result.transactions.filter(t => t.type === "EXPENSE").reduce((s,t) => s+t.amount, 0);
  console.log(`   ✅ Created: ${created} transactions`);
  console.log(`   Income: R${income.toFixed(2)} | Expenses: R${expense.toFixed(2)} | Net: R${(income-expense).toFixed(2)}`);
  return created;
}

async function main() {
  console.log("🏦 MrMoney Bank Statement Import\n" + "═".repeat(45));

  const cap = await importStatement(
    "/Users/zakes/.openclaw/media/inbound/CAPITEC_BUSINESS_FEB_2026---d676e25b-b66e-4138-96d4-e5b81f53a65a.csv",
    "CAPITEC",
    GOLFBNB_PROP,
    "GolfBnB (Capitec Business)"
  );

  const std = await importStatement(
    "/Users/zakes/.openclaw/media/inbound/standard_bank_business---34c4a8bf-b773-469f-bf30-934240e14652.csv",
    "STANDARD_BANK",
    NELSBNB_PROP,
    "NelsBNB (Standard Bank Business)"
  );

  const total = await prisma.transaction.count({ where: { organisationId: ORG_ID } });

  console.log("\n" + "═".repeat(45));
  console.log(`✅ Import complete!`);
  console.log(`   Capitec:       ${cap} transactions`);
  console.log(`   Standard Bank: ${std} transactions`);
  console.log(`   Total in DB:   ${total} transactions`);
  console.log("═".repeat(45));
}

main()
  .catch(e => { console.error("❌", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
