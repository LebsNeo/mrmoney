import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as { organisationId?: string })?.organisationId;
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pin, currentPin } = await req.json();

  // Validate new PIN — 4 digits
  if (!pin || !/^\d{4,8}$/.test(pin)) {
    return NextResponse.json({ error: "PIN must be 4–8 digits" }, { status: 400 });
  }

  // If a PIN already exists, verify current PIN first
  const org = await prisma.$queryRaw<Array<{ financePin: string | null }>>`
    SELECT "financePin" FROM organisations WHERE id = ${orgId}
  `;
  const existing = org[0]?.financePin;

  if (existing) {
    if (!currentPin) return NextResponse.json({ error: "Current PIN required to change" }, { status: 400 });
    const { compare } = await import("bcryptjs");
    const valid = await compare(currentPin, existing);
    if (!valid) return NextResponse.json({ error: "Current PIN is incorrect" }, { status: 401 });
  }

  const hashed = await hash(pin, 10);
  await prisma.$executeRaw`
    UPDATE organisations SET "financePin" = ${hashed} WHERE id = ${orgId}
  `;

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as { organisationId?: string })?.organisationId;
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pin } = await req.json();
  const org = await prisma.$queryRaw<Array<{ financePin: string | null }>>`
    SELECT "financePin" FROM organisations WHERE id = ${orgId}
  `;
  const existing = org[0]?.financePin;
  if (!existing) return NextResponse.json({ ok: true }); // already no PIN

  const { compare } = await import("bcryptjs");
  const valid = await compare(pin, existing);
  if (!valid) return NextResponse.json({ error: "Incorrect PIN" }, { status: 401 });

  await prisma.$executeRaw`
    UPDATE organisations SET "financePin" = NULL WHERE id = ${orgId}
  `;

  return NextResponse.json({ ok: true });
}
