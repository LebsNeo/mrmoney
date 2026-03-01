import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildDigest, formatDigestMessage } from "@/lib/whatsapp/daily-digest";
import { MetaProvider } from "@/lib/whatsapp/providers/meta";
import { TwilioProvider } from "@/lib/whatsapp/providers/twilio";

export const maxDuration = 60;

// Vercel cron calls this with the CRON_SECRET header
function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev mode
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find all orgs with digest enabled
  const orgs = await prisma.organisation.findMany({
    where: {
      digestEnabled: true,
      ownerWhatsApp: { not: null },
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      ownerWhatsApp: true,
      digestTime: true,
    },
  });

  if (orgs.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: "No orgs with digest enabled" });
  }

  // Get current SA time HH:MM
  const saTime = new Date().toLocaleString("en-US", { timeZone: "Africa/Johannesburg" });
  const saDate = new Date(saTime);
  const currentHHMM = `${String(saDate.getHours()).padStart(2, "0")}:${String(saDate.getMinutes()).padStart(2, "0")}`;

  const provider = process.env.TWILIO_ACCOUNT_SID ? TwilioProvider : MetaProvider;

  let sent = 0;
  const errors: string[] = [];

  for (const org of orgs) {
    // Only send if we're within 15 minutes of the configured time
    if (!isWithinWindow(currentHHMM, org.digestTime ?? "07:00", 15)) {
      continue;
    }

    try {
      const data = await buildDigest(org.id);
      if (!data) continue;

      const message = formatDigestMessage(data);
      await provider.send({ to: org.ownerWhatsApp!, body: message });
      sent++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${org.name}: ${msg}`);
      console.error(`Digest failed for ${org.name}:`, err);
    }
  }

  return NextResponse.json({ ok: true, sent, errors });
}

/** Returns true if currentTime is within `windowMinutes` of targetTime (HH:MM) */
function isWithinWindow(current: string, target: string, windowMinutes: number): boolean {
  const [ch, cm] = current.split(":").map(Number);
  const [th, tm] = target.split(":").map(Number);
  const currentMins = ch * 60 + cm;
  const targetMins = th * 60 + tm;
  return Math.abs(currentMins - targetMins) <= windowMinutes;
}
