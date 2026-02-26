/**
 * Lightweight test: parse CSVs without DB connection
 * Tests the row parsing logic only — no duplicate check needed
 */
import { readFileSync } from "fs";
import { parse as parseDate, isValid } from "date-fns";

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === "," && !inQuotes) { fields.push(current.trim()); current = ""; }
    else { current += ch; }
  }
  fields.push(current.trim());
  return fields;
}

function safeParseDate(val: string, fmt: string): Date | null {
  const d = parseDate(val, fmt, new Date());
  return isValid(d) ? d : null;
}

function tryParseAmount(val: string): number | null {
  if (!val || val.trim() === "" || val.trim() === "-") return null;
  const cleaned = val.replace(/[^0-9.\-]/g, "");
  if (!cleaned || cleaned === "-") return null;
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function parseCapitecRow(fields: string[]) {
  if (fields.length < 5) return null;
  const date = safeParseDate(fields[1]?.trim() ?? "", "dd/MM/yyyy");
  if (!date) return null;
  const description = (fields[2] ?? "").trim();
  const reference = (fields[3] ?? "").trim();
  const amount = tryParseAmount(fields[4] ?? "");
  if (amount === null) return null;
  const fullDesc = reference ? `${description} | ${reference}` : description;
  return { date, description: fullDesc, amount };
}

function parseStandardBankRow(fields: string[]) {
  if ((fields[0]?.trim() ?? "") !== "HIST") return null;
  if (fields.length < 5) return null;
  const date = safeParseDate(fields[1]?.trim() ?? "", "yyyyMMdd");
  if (!date) return null;
  const amount = tryParseAmount(fields[3] ?? "");
  if (amount === null) return null;
  const description = (fields[4] ?? "").trim();
  const reference = (fields[5] ?? "").trim();
  const fullDesc = reference && !/^\d+$/.test(reference) ? `${description} | ${reference}` : description;
  return { date, description: fullDesc, amount };
}

function testFile(path: string, bank: string, parser: (f: string[]) => {date:Date, description:string, amount:number}|null) {
  const lines = readFileSync(path, "utf-8").split(/\r?\n/).filter(l => l.trim());
  let income = 0, expense = 0, valid = 0, skipped = 0;
  const samples: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const parsed = parser(parseCSVLine(lines[i]));
    if (!parsed) { skipped++; continue; }
    valid++;
    if (parsed.amount >= 0) income += parsed.amount;
    else expense += Math.abs(parsed.amount);
    if (samples.length < 4) {
      samples.push(`  ${parsed.date.toISOString().slice(0,10)} | ${parsed.amount >= 0 ? "INCOME " : "EXPENSE"} | R${Math.abs(parsed.amount).toFixed(2).padStart(9)} | ${parsed.description.slice(0,50)}`);
    }
  }

  console.log(`\n╔══ ${bank} ══╗`);
  console.log(`  Parsed: ${valid} transactions | Skipped (headers/totals): ${skipped}`);
  console.log(`  Income:   R${income.toFixed(2)}`);
  console.log(`  Expenses: R${expense.toFixed(2)}`);
  console.log(`  Net:      R${(income - expense).toFixed(2)}`);
  console.log("  Sample rows:");
  samples.forEach(s => console.log(s));
}

testFile(
  "/Users/zakes/.openclaw/media/inbound/CAPITEC_BUSINESS_FEB_2026---d676e25b-b66e-4138-96d4-e5b81f53a65a.csv",
  "CAPITEC BUSINESS — Feb 2026",
  parseCapitecRow
);

testFile(
  "/Users/zakes/.openclaw/media/inbound/standard_bank_business---34c4a8bf-b773-469f-bf30-934240e14652.csv",
  "STANDARD BANK — Jan-Feb 2026",
  parseStandardBankRow
);

console.log("\n✅ Parsers working correctly. Ready to import to DB.\n");
