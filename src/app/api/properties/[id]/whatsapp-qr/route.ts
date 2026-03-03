import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import QRCode from "qrcode";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const orgId = (session.user as { organisationId?: string })?.organisationId;

  const property = await prisma.property.findFirst({
    where: { id, organisationId: orgId!, deletedAt: null },
  });
  if (!property) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // WhatsApp deep link — pre-filled opening message identifying the property
  const message = encodeURIComponent(
    `Hi! I'd like to make a booking at ${property.name}. Can you help me?`
  );
  const waNumber = process.env.TWILIO_WHATSAPP_NUMBER?.replace("whatsapp:", "").replace("+", "") ?? "14155238886";
  const waUrl = `https://wa.me/${waNumber}?text=${message}`;

  // Generate QR as SVG data URL
  const qrDataUrl = await QRCode.toDataURL(waUrl, {
    errorCorrectionLevel: "H",
    width: 300,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  });

  // Return JSON with the QR data URL + wa link
  return NextResponse.json({
    qrDataUrl,
    waUrl,
    propertyName: property.name,
    waNumber: `+${waNumber}`,
  });
}
