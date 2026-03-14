import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiUnauthorized, apiServerError } from "@/lib/api-response";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const orgId = (session?.user as any)?.organisationId as string | undefined;
    if (!orgId) return apiUnauthorized();

    const { id } = await params;

    const booking = await prisma.booking.findFirst({
      where: { id, property: { organisationId: orgId }, deletedAt: null },
      include: {
        property: { select: { id: true, name: true } },
        room: { select: { id: true, name: true } },
      },
    });

    if (!booking) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return apiSuccess(booking);
  } catch (err) {
    console.error(err);
    return apiServerError();
  }
}
