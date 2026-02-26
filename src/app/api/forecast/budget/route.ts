import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getBudgetVsActual } from "@/lib/budget-analysis";
import { apiSuccess, apiError, apiUnauthorized, apiServerError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return apiUnauthorized();

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("propertyId");
    const period = searchParams.get("period");

    if (!propertyId) return apiError("propertyId is required");

    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return apiError("period must be in YYYY-MM format");
    }

    const data = await getBudgetVsActual(propertyId, period);
    return apiSuccess(data);
  } catch (err) {
    logger.error("Forecast budget error", err);
    return apiServerError();
  }
}
