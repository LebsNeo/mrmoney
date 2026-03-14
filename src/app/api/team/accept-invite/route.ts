import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { verifyInviteToken } from "@/lib/auth-tokens";

/** GET — verify token and return invite details (no auth required) */
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token") ?? "";
    const invite = verifyInviteToken(token);

    if (!invite) {
      return NextResponse.json({ error: "This invite link is invalid or has expired. Ask your team owner to send a new one." }, { status: 400 });
    }

    // Check if user already exists
    const existing = await prisma.user.findFirst({
      where: { email: invite.email, organisationId: invite.organisationId, deletedAt: null },
    });
    if (existing) {
      return NextResponse.json({ error: "You already have an account. Please sign in instead." }, { status: 400 });
    }

    // Get org name
    const org = await prisma.organisation.findUnique({
      where: { id: invite.organisationId },
      select: { name: true },
    });

    return NextResponse.json({
      email: invite.email,
      organisationId: invite.organisationId,
      role: invite.role,
      orgName: org?.name ?? "Unknown",
    });
  } catch (err) {
    console.error("Accept-invite GET error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

/** POST — create user account from invite */
export async function POST(req: NextRequest) {
  try {
    const { token, name, password } = await req.json();

    if (!token || !name?.trim() || !password) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const invite = verifyInviteToken(token);
    if (!invite) {
      return NextResponse.json({ error: "This invite link is invalid or has expired." }, { status: 400 });
    }

    // Check org exists
    const org = await prisma.organisation.findUnique({
      where: { id: invite.organisationId },
      select: { id: true },
    });
    if (!org) {
      return NextResponse.json({ error: "Organisation not found" }, { status: 400 });
    }

    // Check if user already exists in this org
    const existing = await prisma.user.findFirst({
      where: { email: invite.email, organisationId: invite.organisationId, deletedAt: null },
    });
    if (existing) {
      return NextResponse.json({ error: "You already have an account. Please sign in." }, { status: 400 });
    }

    // Check if email exists in another org — if so, create in this org too (multi-org support)
    const passwordHash = await hash(password, 12);

    await prisma.user.create({
      data: {
        organisationId: invite.organisationId,
        name: name.trim(),
        email: invite.email,
        passwordHash,
        role: invite.role as any,
        emailVerified: true, // invited users are pre-verified
        isActive: true,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Accept-invite POST error:", err);
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 400 });
    }
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
