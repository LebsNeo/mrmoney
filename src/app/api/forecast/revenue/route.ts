import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getRevenueForecast } from "@/lib/forecasting";
import { apiSuccess, apiError, apiUnauthorized, apiServerError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return apiUnauthorized();

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("propertyId");
    const monthsParam = searchParams.get("months") ?? "3";

    if (!propertyId) return apiError("propertyId is required");

    const months = parseInt(monthsParam, 10);
    if (isNaN(months) || months < 1 || months > 12) {
      return apiError("months must be between 1 and 12");
    }

    const data = await getRevenueForecast(propertyId, months);
    return apiSuccess(data);
  } catch (err) {
    logger.error("Forecast revenue error", err);
    return apiServerError();
  }
}
