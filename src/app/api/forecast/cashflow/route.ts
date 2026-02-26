import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCashFlowForecast } from "@/lib/forecasting";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const propertyId = searchParams.get("propertyId");
  const daysParam = searchParams.get("days") ?? "30";

  if (!propertyId) {
    return NextResponse.json({ error: "propertyId is required" }, { status: 400 });
  }

  const days = parseInt(daysParam, 10) as 30 | 60 | 90;
  if (![30, 60, 90].includes(days)) {
    return NextResponse.json(
      { error: "days must be 30, 60, or 90" },
      { status: 400 }
    );
  }

  const data = await getCashFlowForecast(propertyId, days);
  return NextResponse.json(data);
}
