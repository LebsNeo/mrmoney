/**
 * MrMoney — QuickBooks CSV Import
 * Parses QB transaction list export format
 */

import { TransactionCategory, TransactionType } from "@prisma/client";
import { parse as parseDate, isValid } from "date-fns";
import { autoCategoriseTransaction, Confidence } from "./auto-categorise";
import { prisma } from "./prisma";
import { ParsedTransaction } from "./bank-import";

// Re-export for convenience
export type { ParsedTransaction };

export interface QBImportResult {
  transactions: ParsedTransaction[];
  potentialDuplicates: ParsedTransaction[];
  unrecognised: string[];
}

// ─────────────────────────────────────────────
// CSV helpers
// ─────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function tryParseAmount(raw: string): number | null {
  if (!raw || raw.trim() === "") return null;
  const cleaned = raw.replace(/[^0-9.\-]/g, "");
  const val = parseFloat(cleaned);
  return isNaN(val) ? null : val;
}

function safeParseDate(raw: string): Date | null {
  const formats = ["MM/dd/yyyy", "dd/MM/yyyy", "yyyy-MM-dd", "MM-dd-yyyy"];
  for (const fmt of formats) {
    const d = parseDate(raw.trim(), fmt, new Date());
    if (isValid(d)) return d;
  }
  return null;
}

async function checkDuplicate(
  amount: number,
  date: Date,
  propertyId: string
): Promise<boolean> {
  const dayBefore = new Date(date);
  dayBefore.setDate(dayBefore.getDate() - 1);
  const dayAfter = new Date(date);
  dayAfter.setDate(dayAfter.getDate() + 1);

  const absAmt = Math.abs(amount);
  const existing = await prisma.transaction.findFirst({
    where: {
      propertyId,
      deletedAt: null,
      date: { gte: dayBefore, lte: dayAfter },
      amount: {
        gte: absAmt - 1,
        lte: absAmt + 1,
      },
    },
    select: { id: true },
  });
  return !!existing;
}

// ─────────────────────────────────────────────
// QB Column indices:
// Date, Transaction Type, Num, Name, Memo/Description, Amount
// ─────────────────────────────────────────────

export async function parseQuickBooksCSV(
  csvContent: string,
  propertyId: string,
  _organisationId: string
): Promise<QBImportResult> {
  const lines = csvContent.split(/\r?\n/).filter((l) => l.trim() !== "");
  const transactions: ParsedTransaction[] = [];
  const potentialDuplicates: ParsedTransaction[] = [];
  const unrecognised: string[] = [];

  // Find header row - QB sometimes has metadata rows at top
  let headerIdx = 0;
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    if (lines[i].toLowerCase().includes("date") && lines[i].toLowerCase().includes("amount")) {
      headerIdx = i;
      break;
    }
  }

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const fields = parseCSVLine(line);
    if (fields.length < 5) {
      unrecognised.push(line);
      continue;
    }

    // Date(0), TxType(1), Num(2), Name(3), Memo/Description(4), Amount(5)
    const date = safeParseDate(fields[0]);
    if (!date) {
      unrecognised.push(line);
      continue;
    }

    const vendorName = fields[3] ?? "";
    const description = fields[4] || fields[1] || "QB Import";
    const rawAmount = tryParseAmount(fields[5] ?? fields[4] ?? "");

    if (rawAmount === null) {
      unrecognised.push(line);
      continue;
    }

    // QB: positive = income, negative = expense
    const type: TransactionType = rawAmount >= 0 ? "INCOME" : "EXPENSE";
    const absAmount = Math.abs(rawAmount);

    const cat = autoCategoriseTransaction(description, vendorName);
    const isDuplicate = await checkDuplicate(absAmount, date, propertyId);

    const tx: ParsedTransaction = {
      date,
      description: description || vendorName || "QB Import",
      amount: absAmount,
      type,
      category: cat.category,
      confidence: cat.confidence,
      isDuplicate,
      raw: line,
    };

    if (isDuplicate) {
      potentialDuplicates.push(tx);
    } else {
      transactions.push(tx);
    }
  }

  return { transactions, potentialDuplicates, unrecognised };
}
