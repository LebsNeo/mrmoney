import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPropertiesWithRooms } from "@/lib/actions/bookings";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "no session" });

    const properties = await getPropertiesWithRooms();
    return NextResponse.json({ ok: true, count: properties.length, properties });
  } catch (e: unknown) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack?.split("\n").slice(0, 6) : null,
    });
  }
}
