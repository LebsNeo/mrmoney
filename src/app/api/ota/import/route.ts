import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  parseLekkerslaapCSV,
  parseBookingComCSV,
  parseAirbnbCSV,
  saveOTAPayoutsToDb,
} from "@/lib/ota-import";
import { apiError, apiSuccess } from "@/lib/api-response";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return apiError("Unauthorised", 401);
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const platform = formData.get("platform") as string;
    const propertyId = formData.get("propertyId") as string;
    const organisationId = formData.get("organisationId") as string;

    if (!file || !platform || !propertyId || !organisationId) {
      return apiError("Missing required fields: file, platform, propertyId, organisationId");
    }

    const validPlatforms = ["BOOKING_COM", "LEKKERSLAAP", "AIRBNB"];
    if (!validPlatforms.includes(platform)) {
      return apiError(`Invalid platform. Must be one of: ${validPlatforms.join(", ")}`);
    }

    logger.info("OTA import started", { platform, propertyId, filename: file.name });

    let parseResult;

    // All three platforms use CSV export
    const text = await file.text();
    if (platform === "AIRBNB") {
      parseResult = parseAirbnbCSV(text);
    } else if (platform === "LEKKERSLAAP") {
      parseResult = parseLekkerslaapCSV(text);
    } else {
      // BOOKING_COM
      parseResult = parseBookingComCSV(text);
    }

    // Save to database
    const saveResult = await saveOTAPayoutsToDb(
      parseResult,
      propertyId,
      organisationId,
      file.name
    );

    logger.info("OTA import complete", { platform, ...saveResult });

    return apiSuccess({
      ...saveResult,
      platform,
      periodStart: parseResult.periodStart,
      periodEnd: parseResult.periodEnd,
      totalGross: parseResult.totalGross,
      totalNet: parseResult.totalNet,
      bookingCount: parseResult.bookingCount,
    });
  } catch (error) {
    logger.error("OTA import failed", error);
    return apiError(
      error instanceof Error ? error.message : "Import failed",
      500
    );
  }
}
