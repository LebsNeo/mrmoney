import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as { organisationId?: string })?.organisationId;
  if (!orgId) {
    return NextResponse.json({ count: 0 });
  }

  const count = await prisma.alert.count({
    where: { organisationId: orgId, isRead: false },
  });

  return NextResponse.json({ count });
}
