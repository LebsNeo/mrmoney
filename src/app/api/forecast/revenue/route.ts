import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getRevenueForecast } from "@/lib/forecasting";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const propertyId = searchParams.get("propertyId");
  const monthsParam = searchParams.get("months") ?? "3";

  if (!propertyId) {
    return NextResponse.json({ error: "propertyId is required" }, { status: 400 });
  }

  const months = parseInt(monthsParam, 10);
  if (isNaN(months) || months < 1 || months > 12) {
    return NextResponse.json(
      { error: "months must be between 1 and 12" },
      { status: 400 }
    );
  }

  const data = await getRevenueForecast(propertyId, months);
  return NextResponse.json(data);
}
