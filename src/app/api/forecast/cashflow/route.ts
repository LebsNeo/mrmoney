import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCashFlowForecast } from "@/lib/forecasting";
import { apiSuccess, apiError, apiUnauthorized, apiServerError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return apiUnauthorized();

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("propertyId");
    const daysParam = searchParams.get("days") ?? "30";

    if (!propertyId) return apiError("propertyId is required");

    const days = parseInt(daysParam, 10) as 30 | 60 | 90;
    if (![30, 60, 90].includes(days)) {
      return apiError("days must be 30, 60, or 90");
    }

    const data = await getCashFlowForecast(propertyId, days);
    return apiSuccess(data);
  } catch (err) {
    logger.error("Forecast cashflow error", err);
    return apiServerError();
  }
}
