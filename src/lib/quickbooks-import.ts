/**
 * MrCA — QuickBooks CSV Import
 *
 * Handles QB "Transaction List by Date" export format:
 *   Row 0-2: metadata headers  (skipped — we find the real header row)
 *   Row 3:   Date, Transaction type, Number, Posting (Y/N), Name,
 *            Memo/Description, Account name, Account full name, Amount
 *   Row 4+:  data
 *
 * Col indices (0-based):
 *   0 = Date          (DD/MM/YYYY)
 *   1 = Tx type       (Deposit | Expense | Transfer)
 *   2 = Number
 *   3 = Posting Y/N
 *   4 = Name          (vendor / payee)
 *   5 = Memo/Desc
 *   6 = Account name  (bank account)
 *   7 = Account full name  (QB category — used for MrCA category mapping)
 *   8 = Amount        (signed: positive = income, negative = expense)
 */

import { TransactionCategory, TransactionType } from "@prisma/client";
import { parse as parseDate, isValid } from "date-fns";
import { Confidence } from "./auto-categorise";
import { prisma } from "./prisma";
import { ParsedTransaction } from "./bank-import";
import { logger } from "./logger";

export type { ParsedTransaction };

export interface QBImportResult {
  transactions: ParsedTransaction[];
  potentialDuplicates: ParsedTransaction[];
  unrecognised: string[];
}

// ─────────────────────────────────────────────
// Helpers
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
  // Remove thousands commas, keep minus and decimal
  const cleaned = raw.replace(/[^0-9.\-]/g, "");
  const val = parseFloat(cleaned);
  return isNaN(val) ? null : val;
}

function safeParseDate(raw: string): Date | null {
  // Try DD/MM/YYYY first (SA format used by QB), then ISO
  const fmts = ["dd/MM/yyyy", "yyyy-MM-dd", "MM/dd/yyyy"];
  for (const fmt of fmts) {
    const d = parseDate(raw.trim(), fmt, new Date());
    if (isValid(d)) {
      // Fix timezone-related off-by-one: set time to noon so UTC storage
      // doesn't shift the date back across midnight (SA = UTC+2)
      d.setHours(12, 0, 0, 0);
      return d;
    }
  }
  return null;
}

// ─────────────────────────────────────────────
// QB Account full name → TransactionCategory
// ─────────────────────────────────────────────

/** Returns null for rows that should be SKIPPED (balance sheet / inter-account) */
function mapQBCategory(accountFullName: string): TransactionCategory | null {
  const n = accountFullName.toLowerCase().trim();

  // ── SKIP: non-operating / balance-sheet items ──────────────────────────────
  // Long-term debt (loan repayments), investments, ATM cash withdrawals,
  // inter-account transfers, payroll clearing, etc.
  const skip = [
    "long-term debt", "long term debt",
    "long-term investments", "long term investments",
    "investment",                // pure investment accounts
    "cash and cash equivalents", // ATM withdrawals
    "uncategorised asset",
    "nelsbnb standard bank account",
    "standard bank",
    "capitec business account",  // this is just the clearing account label — skip
    "business cheque account",
    "payroll clearing",
    "short-term debit",
    "loan to smart gowns",
    "nelsbnb standard bank",
    "accrued holiday payable",   // QB bond-repayment RTD entry — skip
    "sbsa home",                  // bond repayment entries
  ];
  if (skip.some((s) => n.includes(s))) return null;

  // ── INCOME categories ──────────────────────────────────────────────────────
  if (n === "sales" || n.startsWith("uncategorised income")) return "ACCOMMODATION";
  if (n.includes("travel expenses") && n.includes("inward")) return "ACCOMMODATION";

  // ── EXPENSE categories ─────────────────────────────────────────────────────
  if (n.includes("wage") || n.includes("salary") || n.includes("salaries")
      || n.includes("payroll") || n.includes("management compensation")
      || n.includes("direct labour") || n.includes("employee")) return "SALARIES";

  if (n.includes("marketing") || n.includes("google") || n.includes("facebook")
      || n.includes("advertising")) return "MARKETING";

  if (n.includes("bank charge") || n.includes("bank fee")) return "BANK_CHARGES";

  if (n.includes("utilities") || n.includes("electricity") || n.includes("water")
      || n.includes("internet") || n.includes("silulumanzi") || n.includes("vox")) return "UTILITIES";

  if (n.includes("repairs") || n.includes("maintenance") || n.includes("building asset")
      || n.includes("renovation") || n.includes("plumb") || n.includes("hardware")
      || n.includes("buco") || n.includes("bwh")) return "MAINTENANCE";

  if (n.includes("ota_commission") || n.includes("sales commission")
      || n.includes("commissions and fees") || n.includes("commission")) return "OTA_COMMISSION";

  if (n.includes("guest house consumable") || n.includes("consumable")
      || n.includes("groceries") || n.includes("spar") || n.includes("makro")) return "SUPPLIES";

  if (n.includes("office expense") || n.includes("operating equipment")
      || n.includes("cleaning") || n.includes("chem kleen")) return "SUPPLIES";

  if (n.includes("insurance")) return "OTHER";
  if (n.includes("meals") || n.includes("entertainment")) return "OTHER";
  if (n.includes("travel")) return "OTHER";
  if (n.includes("dues") || n.includes("subscription")) return "OTHER";
  if (n.includes("shipping") || n.includes("delivery")) return "OTHER";
  if (n.includes("prepaid")) return "OTHER";
  if (n.includes("legal") || n.includes("professional fee")
      || n.includes("accounting")) return "OTHER";
  if (n.includes("overhead")) return "OTHER";
  if (n.includes("uncategorised expense")) return "OTHER";
  if (n.includes("dividend")) return "OTHER";
  if (n.includes("refund")) return "OTHER";
  if (n.includes("operating expense")) return "OTHER";
  if (n.includes("business furniture")) return "MAINTENANCE";

  // Default — include as OTHER so nothing is silently lost
  return "OTHER";
}

// ─────────────────────────────────────────────
// Duplicate check
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
      amount: { gte: absAmt - 1, lte: absAmt + 1 },
    },
    select: { id: true },
  });
  return !!existing;
}

// ─────────────────────────────────────────────
// Main parser
// ─────────────────────────────────────────────

export async function parseQuickBooksCSV(
  csvContent: string,
  propertyId: string,
  organisationId: string,
  skipDuplicateCheck = false
): Promise<QBImportResult> {
  const lines = csvContent.split(/\r?\n/).filter((l) => l.trim() !== "");
  const transactions: ParsedTransaction[] = [];
  const potentialDuplicates: ParsedTransaction[] = [];
  const unrecognised: string[] = [];

  // Find the real header row (contains "date" AND "transaction type" AND "amount")
  let headerIdx = -1;
  for (let i = 0; i < Math.min(8, lines.length); i++) {
    const lower = lines[i].toLowerCase();
    if (lower.includes("transaction type") && lower.includes("amount") && lower.includes("date")) {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx === -1) {
    logger.warn("QuickBooks header row not found");
    return { transactions: [], potentialDuplicates: [], unrecognised: lines };
  }

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const fields = parseCSVLine(line);
    // Minimum columns: Date(0), TxType(1), ..., Amount(8) = 9 columns
    if (fields.length < 9) {
      unrecognised.push(line);
      continue;
    }

    // Date
    const date = safeParseDate(fields[0]);
    if (!date) {
      unrecognised.push(line);
      continue;
    }

    // Transaction type — skip transfers (inter-account moves)
    const txType = (fields[1] ?? "").trim().toLowerCase();
    if (txType === "transfer") continue; // silent skip

    if (txType !== "deposit" && txType !== "expense") {
      unrecognised.push(line);
      continue;
    }

    // Account full name (QB category)
    const accountFullName = (fields[7] ?? "").trim();
    const mappedCategory = mapQBCategory(accountFullName);
    if (mappedCategory === null) continue; // skip balance-sheet rows silently

    // Amount
    const rawAmount = tryParseAmount(fields[8] ?? "");
    if (rawAmount === null || rawAmount === 0) {
      unrecognised.push(line);
      continue;
    }

    // Description: prefer col 5 (Memo), fallback to col 4 (Name)
    const memo = (fields[5] ?? "").trim();
    const name = (fields[4] ?? "").trim();
    const description = memo || name || accountFullName || "QB Import";

    // Income/Expense based on sign (Deposits positive, Expenses negative)
    const type: TransactionType = rawAmount >= 0 ? "INCOME" : "EXPENSE";
    const absAmount = Math.abs(rawAmount);

    // Confidence: HIGH since QB has pre-assigned categories
    const confidence: Confidence = accountFullName && accountFullName !== "Uncategorised Expense"
      && accountFullName !== "Other operating income (expenses)" ? "HIGH" : "LOW";

    const isDuplicate = skipDuplicateCheck
      ? false
      : await checkDuplicate(absAmount, date, propertyId);

    const tx: ParsedTransaction = {
      date,
      description,
      amount: absAmount,
      type,
      category: mappedCategory,
      confidence,
      isDuplicate,
      raw: line,
    };

    if (isDuplicate) {
      potentialDuplicates.push(tx);
    } else {
      transactions.push(tx);
    }
  }

  logger.info("QuickBooks CSV parsed", {
    propertyId,
    organisationId,
    valid: transactions.length,
    duplicates: potentialDuplicates.length,
    unrecognised: unrecognised.length,
  });

  return { transactions, potentialDuplicates, unrecognised };
}
