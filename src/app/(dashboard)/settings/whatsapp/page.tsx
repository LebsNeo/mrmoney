import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { WhatsAppSetupClient } from "./WhatsAppSetupClient";

export default async function WhatsAppSettingsPage() {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as { organisationId?: string })?.organisationId;

  const recentConversations = orgId
    ? await prisma.whatsAppConversation.findMany({
        where: { organisationId: orgId },
        include: {
          booking: {
            select: { id: true, checkIn: true, checkOut: true, status: true, grossAmount: true },
          },
        },
        orderBy: { lastMessageAt: "desc" },
        take: 20,
      })
    : [];

  const stats = {
    total: recentConversations.length,
    confirmed: recentConversations.filter((c) => c.state === "CONFIRMED").length,
    pending: recentConversations.filter((c) => c.state === "CONFIRMING").length,
    cancelled: recentConversations.filter((c) => c.state === "CANCELLED").length,
  };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://mrmoney.vercel.app";
  const webhookUrl = `${appUrl}/api/whatsapp/webhook`;

  // Serialise
  const serialised = recentConversations.map((c) => ({
    ...c,
    extracted: c.extracted as Record<string, unknown> | null,
    lastMessageAt: c.lastMessageAt.toISOString(),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    booking: c.booking
      ? {
          ...c.booking,
          checkIn: c.booking.checkIn.toISOString(),
          checkOut: c.booking.checkOut.toISOString(),
          grossAmount: parseFloat(String(c.booking.grossAmount)),
        }
      : null,
  }));

  return (
    <div>
      <PageHeader
        title="WhatsApp Booking Intake"
        description="Guests message your WhatsApp number — MrMoney auto-creates bookings"
      />
      <WhatsAppSetupClient
        webhookUrl={webhookUrl}
        stats={stats}
        conversations={serialised}
      />
    </div>
  );
}
