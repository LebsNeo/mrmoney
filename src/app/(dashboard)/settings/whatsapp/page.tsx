import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Suspense } from "react";
import { PageHeader } from "@/components/PageHeader";
import { WhatsAppSetupClient } from "./WhatsAppSetupClient";
import { WhatsAppConnectionClient } from "./WhatsAppConnectionClient";

export default async function WhatsAppSettingsPage() {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as { organisationId?: string })?.organisationId;

  const [recentConversations, connection] = await Promise.all([
    orgId
      ? prisma.whatsAppConversation.findMany({
          where: { organisationId: orgId },
          include: {
            booking: {
              select: { id: true, checkIn: true, checkOut: true, status: true, grossAmount: true },
            },
          },
          orderBy: { lastMessageAt: "desc" },
          take: 20,
        })
      : Promise.resolve([]),
    orgId
      ? prisma.whatsAppConnection.findUnique({ where: { organisationId: orgId } })
      : Promise.resolve(null),
  ]);

  const stats = {
    total: recentConversations.length,
    confirmed: recentConversations.filter((c) => c.state === "CONFIRMED").length,
    pending: recentConversations.filter((c) => c.state === "CONFIRMING").length,
    cancelled: recentConversations.filter((c) => c.state === "CANCELLED").length,
  };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.mrca.co.za";
  const webhookUrl = `${appUrl}/api/whatsapp/webhook`;

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

  const serialisedConnection = connection
    ? {
        id: connection.id,
        phoneNumberId: connection.phoneNumberId,
        wabaId: connection.wabaId,
        displayPhone: connection.displayPhone,
        isActive: connection.isActive,
        // Never expose tokens to client
      }
    : null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="WhatsApp Settings"
        description="Connect your WhatsApp Business number and manage booking intake"
      />

      {/* Connection Management */}
      <Suspense fallback={null}>
      <WhatsAppConnectionClient
        connection={serialisedConnection}
        webhookUrl={webhookUrl}
        verifyToken={process.env.WHATSAPP_VERIFY_TOKEN ?? "mrca_webhook_2026"}
      />
      </Suspense>

      {/* Conversation Stats & History */}
      <WhatsAppSetupClient
        webhookUrl={webhookUrl}
        stats={stats}
        conversations={serialised}
      />
    </div>
  );
}
