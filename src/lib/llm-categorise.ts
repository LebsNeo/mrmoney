/**
 * MrCA — LLM Batch Categorisation
 *
 * Sends LOW/OTHER confidence transactions to GPT-4o-mini in a single batch.
 * Returns categorisation results with HIGH confidence (LLM-assigned).
 * Cost: ~$0.0003 per 20 transactions (~R0.005)
 */

import { TransactionCategory } from "@prisma/client";
import { CategorisationResult } from "./auto-categorise";

const VALID_CATEGORIES = [
  "ACCOMMODATION", "FB", "LAUNDRY", "CLEANING", "SUPPLIES", "OTA_COMMISSION",
  "MAINTENANCE", "UTILITIES", "SALARIES", "MARKETING", "BANK_CHARGES",
  "LOAN_INTEREST", "VAT_OUTPUT", "VAT_INPUT", "EMPLOYEE_ADVANCE", "OTHER",
] as const;

const CATEGORY_DESCRIPTIONS = `
ACCOMMODATION - Room revenue, guest payments, booking income, POS card settlements from guests
FB - Food & beverage, restaurant, groceries, catering
LAUNDRY - Laundry, dry cleaning, linen cleaning services
CLEANING - Cleaning services, housekeeping, domestic workers
SUPPLIES - Guest room supplies, amenities, toiletries, linen purchases
OTA_COMMISSION - Booking.com/Airbnb/Lekkerslaap commission fees
MAINTENANCE - Repairs, maintenance, contractors, installations, electric fence
UTILITIES - Electricity, water, internet, municipal rates, bank monthly fees, SMS fees
SALARIES - Staff salaries, wages, employee payments
MARKETING - Advertising, marketing, promotions
BANK_CHARGES - Bank fees, transaction fees, service charges, monthly account fees
LOAN_INTEREST - Loan repayments, bond, interest charges
VAT_OUTPUT - VAT payments to SARS
VAT_INPUT - VAT on purchases (input tax)
EMPLOYEE_ADVANCE - Salary advances to staff
OTHER - Cannot be determined from description
`.trim();

export interface TxToClassify {
  index: number;
  description: string;
  amount: number;
  type: "INCOME" | "EXPENSE";
}

export async function llmBatchCategorise(
  transactions: TxToClassify[],
  businessContext = "South African guesthouse/BnB in Mpumalanga"
): Promise<Map<number, CategorisationResult>> {
  const results = new Map<number, CategorisationResult>();

  if (!transactions.length) return results;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // No API key — return OTHER for all
    transactions.forEach((tx) => {
      results.set(tx.index, { category: "OTHER", confidence: "LOW", rule: "no-api-key" });
    });
    return results;
  }

  // Build the prompt
  const txList = transactions
    .map((tx) => `${tx.index}|${tx.type}|R${Math.abs(tx.amount).toFixed(2)}|${tx.description}`)
    .join("\n");

  const prompt = `You are a financial categorisation assistant for a ${businessContext}.

Categorise each bank transaction below into exactly one of these categories:
${CATEGORY_DESCRIPTIONS}

Rules:
- "Inward EFT Credit" + "PosSettle" = guest card payments = ACCOMMODATION
- Transfers to own accounts (e.g. "NelsBnB standard bank") = ignore for now = OTHER
- Personal payments (e.g. "Lebo Lebo", "Tumisang Lebo") = SALARIES or EMPLOYEE_ADVANCE
- Commission payments to people (e.g. "Ndlovu commission") = SALARIES
- "Truck guy" / transport for property work = MAINTENANCE
- "Malume Mnguni" type personal payments = SALARIES
- Cash deposits = ACCOMMODATION (likely guest payment)
- Municipal rates/Mbombela rates = UTILITIES
- Bank monthly/SMS fees = BANK_CHARGES

Respond with ONLY a JSON array, one object per transaction, in this exact format:
[{"i": <index>, "cat": "<CATEGORY>", "conf": <0-100>}]

Transactions:
${txList}`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: transactions.length * 30 + 100,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content ?? "{}";

    // Parse — model returns { results: [...] } or just [...]
    let parsed: Array<{ i: number; cat: string; conf: number }> = [];
    try {
      const obj = JSON.parse(raw);
      parsed = Array.isArray(obj) ? obj : (obj.results ?? obj.transactions ?? Object.values(obj)[0] ?? []);
    } catch {
      // Fallback: try to extract JSON array from text
      const match = raw.match(/\[[\s\S]*\]/);
      if (match) parsed = JSON.parse(match[0]);
    }

    for (const item of parsed) {
      const cat = VALID_CATEGORIES.includes(item.cat as any)
        ? (item.cat as TransactionCategory)
        : "OTHER";
      const conf = item.conf >= 80 ? "HIGH" : item.conf >= 50 ? "MEDIUM" : "LOW";
      results.set(item.i, { category: cat, confidence: conf, rule: "llm:gpt-4o-mini" });
    }
  } catch (err) {
    console.error("[llm-categorise] Error:", err);
    // Graceful fallback — leave as OTHER
  }

  // Fill any missing results
  transactions.forEach((tx) => {
    if (!results.has(tx.index)) {
      results.set(tx.index, { category: "OTHER", confidence: "LOW", rule: "llm-fallback" });
    }
  });

  return results;
}
