/**
 * MrMoney — SA Bank Statement CSV Import
 * Parsers for FNB, NEDBANK, ABSA, STANDARD_BANK, CAPITEC
 */

import { TransactionCategory, TransactionType } from "@prisma/client";
import { parse as parseDate, isValid } from "date-fns";
import { autoCategoriseTransaction, Confidence } from "./auto-categorise";
import { prisma } from "./prisma";
import { logger } from "./logger";

export interface ParsedTransaction {
  date: Date;
  description: string;
  amount: number; // absolute value
  type: TransactionType;
  category: TransactionCategory;
  confidence: Confidence;
  isDuplicate: boolean;
  raw?: string;
}

export interface BankImportResult {
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

function safeParseDate(raw: string, fmt: string): Date | null {
  const d = parseDate(raw.trim(), fmt, new Date());
  return isValid(d) ? d : null;
}

// ─────────────────────────────────────────────
// Bank-specific parsers
// ─────────────────────────────────────────────

function parseFNBRow(fields: string[]): { date: Date; description: string; amount: number } | null {
  // FNB: Date, Description, Amount, Balance
  if (fields.length < 3) return null;
  const date = safeParseDate(fields[0], "dd MMM yyyy");
  if (!date) return null;
  const description = fields[1] ?? "";
  const amount = tryParseAmount(fields[2]);
  if (amount === null) return null;
  return { date, description, amount };
}

function parseABSARow(fields: string[]): { date: Date; description: string; amount: number } | null {
  // ABSA: Date, Description, Debit Amount, Credit Amount, Balance
  if (fields.length < 4) return null;
  const date = safeParseDate(fields[0], "dd/MM/yyyy");
  if (!date) return null;
  const description = fields[1] ?? "";
  const debit = tryParseAmount(fields[2]);
  const credit = tryParseAmount(fields[3]);
  // Debit = expense (positive value), Credit = income (positive value)
  if (credit !== null && credit !== 0) {
    return { date, description, amount: Math.abs(credit) };
  }
  if (debit !== null && debit !== 0) {
    return { date, description, amount: -Math.abs(debit) };
  }
  return null;
}

function parseNEDBankRow(fields: string[]): { date: Date; description: string; amount: number } | null {
  // NEDBANK: Date, Description, Debit, Credit, Balance
  if (fields.length < 4) return null;
  const date = safeParseDate(fields[0], "yyyy/MM/dd");
  if (!date) return null;
  const description = fields[1] ?? "";
  const debit = tryParseAmount(fields[2]);
  const credit = tryParseAmount(fields[3]);
  if (credit !== null && credit !== 0) {
    return { date, description, amount: Math.abs(credit) };
  }
  if (debit !== null && debit !== 0) {
    return { date, description, amount: -Math.abs(debit) };
  }
  return null;
}

function parseStandardBankRow(fields: string[]): { date: Date; description: string; amount: number } | null {
  // STANDARD_BANK: Date, Description, Amount, Balance
  if (fields.length < 3) return null;
  const date = safeParseDate(fields[0], "dd/MM/yyyy");
  if (!date) return null;
  const description = fields[1] ?? "";
  const amount = tryParseAmount(fields[2]);
  if (amount === null) return null;
  return { date, description, amount };
}

function parseCapitecRow(fields: string[]): { date: Date; description: string; amount: number } | null {
  // CAPITEC: Date, Description, Out, In, Balance
  if (fields.length < 4) return null;
  const date = safeParseDate(fields[0], "yyyy-MM-dd");
  if (!date) return null;
  const description = fields[1] ?? "";
  const outVal = tryParseAmount(fields[2]);
  const inVal = tryParseAmount(fields[3]);
  if (inVal !== null && inVal !== 0) {
    return { date, description, amount: Math.abs(inVal) };
  }
  if (outVal !== null && outVal !== 0) {
    return { date, description, amount: -Math.abs(outVal) };
  }
  return null;
}

// ─────────────────────────────────────────────
// Deduplicate check
// ─────────────────────────────────────────────

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
// Main parser
// ─────────────────────────────────────────────

export async function parseBankStatementCSV(
  csvContent: string,
  bankFormat: string,
  propertyId: string,
  _organisationId: string
): Promise<BankImportResult> {
  const lines = csvContent.split(/\r?\n/).filter((l) => l.trim() !== "");
  const transactions: ParsedTransaction[] = [];
  const potentialDuplicates: ParsedTransaction[] = [];
  const unrecognised: string[] = [];

  // Skip header line (index 0)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const fields = parseCSVLine(line);

    let parsed: { date: Date; description: string; amount: number } | null = null;

    switch (bankFormat.toUpperCase()) {
      case "FNB":
        parsed = parseFNBRow(fields);
        break;
      case "ABSA":
        parsed = parseABSARow(fields);
        break;
      case "NEDBANK":
        parsed = parseNEDBankRow(fields);
        break;
      case "STANDARD_BANK":
        parsed = parseStandardBankRow(fields);
        break;
      case "CAPITEC":
        parsed = parseCapitecRow(fields);
        break;
      default:
        unrecognised.push(line);
        continue;
    }

    if (!parsed) {
      unrecognised.push(line);
      continue;
    }

    // Handle ABSA/NEDBANK/CAPITEC which encode sign in amount directly
    const rawAmount = parsed.amount;
    const type: TransactionType = rawAmount >= 0 ? "INCOME" : "EXPENSE";
    const absAmount = Math.abs(rawAmount);

    const cat = autoCategoriseTransaction(parsed.description);
    const isDuplicate = await checkDuplicate(absAmount, parsed.date, propertyId);

    const tx: ParsedTransaction = {
      date: parsed.date,
      description: parsed.description,
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

  logger.info("Bank statement parsed", {
    bankFormat,
    valid: transactions.length,
    duplicates: potentialDuplicates.length,
    unrecognised: unrecognised.length,
  });

  return { transactions, potentialDuplicates, unrecognised };
}
