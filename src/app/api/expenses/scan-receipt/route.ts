import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiSuccess, apiError, apiUnauthorized, apiServerError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

const CATEGORIES = [
  "ACCOMMODATION", "FB", "LAUNDRY", "CLEANING", "MAINTENANCE",
  "UTILITIES", "SALARIES", "MARKETING", "SUPPLIES", "OTA_COMMISSION",
  "VAT_OUTPUT", "VAT_INPUT", "OTHER",
];

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return apiUnauthorized();

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return apiError("OpenAI API key not configured");

    const formData = await req.formData();
    const file = formData.get("image") as File | null;
    if (!file) return apiError("No image provided");

    // Convert to base64
    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const mimeType = file.type || "image/jpeg";

    const prompt = `You are a financial assistant reading a South African till slip or tax invoice.
Extract the following information and respond ONLY with a JSON object, no markdown:
{
  "store": "store or supplier name",
  "date": "YYYY-MM-DD or null if not found",
  "total": number (total amount paid, in ZAR, as a decimal),
  "subtotal": number (before VAT, or same as total if no VAT shown),
  "vatAmount": number (VAT amount if shown, else 0),
  "items": [{"description": "item name", "amount": number}],
  "category": "one of: ${CATEGORIES.join(", ")}",
  "confidence": "HIGH | MEDIUM | LOW",
  "notes": "brief explanation of category choice"
}

Category hints:
- CLEANING: cleaning products, Mr Min, Handy Andy, mops, etc.
- MAINTENANCE: hardware, tools, plumbing, electrical, paint, Builders Warehouse, BUCO
- SUPPLIES: guest supplies, toiletries, bedding, towels
- FB: food, beverages, Checkers, Spar, Pick n Pay, restaurants
- UTILITIES: electricity, water, gas, prepaid tokens
- SALARIES: wages paid to staff
- MARKETING: Google Ads, printing, signage
- OTHER: anything that doesn't fit above

If you cannot read the image clearly, set confidence to LOW and make your best guess.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64}`,
                detail: "high",
              },
            },
          ],
        }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      logger.error("OpenAI API error", err);
      return apiError("Receipt scan failed — please enter manually");
    }

    const result = await response.json();
    const text = result.choices?.[0]?.message?.content ?? "";

    // Strip any markdown code fences if present
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      logger.error("Failed to parse AI response", text);
      return apiError("Could not read receipt — please enter manually");
    }

    logger.info("Receipt scanned", { store: parsed.store, total: parsed.total, confidence: parsed.confidence });
    return apiSuccess(parsed);
  } catch (err) {
    logger.error("scan-receipt error", err);
    return apiServerError();
  }
}
