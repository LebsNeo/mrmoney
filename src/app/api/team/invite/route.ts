"use server";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { signInviteToken } from "@/lib/auth-tokens";
import { inviteEmailTemplate, sendEmail } from "@/lib/email-templates";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as { name?: string; role?: string; organisationId?: string } | undefined;
    if (!user?.organisationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only OWNER and MANAGER can invite
    if (user.role !== "OWNER" && user.role !== "MANAGER") {
      return NextResponse.json({ error: "Only owners and managers can invite team members" }, { status: 403 });
    }

    const { email, role } = await req.json();

    if (!email?.trim() || !role) {
      return NextResponse.json({ error: "Email and role are required" }, { status: 400 });
    }

    const validRoles = ["MANAGER", "ACCOUNTANT", "STAFF"];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: "Invalid role. Must be MANAGER, ACCOUNTANT, or STAFF" }, { status: 400 });
    }

    // Check if user already exists in this org
    const existing = await prisma.user.findFirst({
      where: { email: email.toLowerCase().trim(), organisationId: user.organisationId, deletedAt: null },
    });
    if (existing) {
      return NextResponse.json({ error: "This person is already a team member" }, { status: 400 });
    }

    // Get org name for email
    const org = await prisma.organisation.findUnique({
      where: { id: user.organisationId },
      select: { name: true },
    });

    // Generate invite token
    const token = signInviteToken(email.toLowerCase().trim(), user.organisationId, role);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.mrca.co.za";
    const inviteUrl = `${appUrl}/accept-invite?token=${encodeURIComponent(token)}`;

    // Send invite email
    const { subject, html, text } = inviteEmailTemplate({
      inviterName: user.name ?? "Your team",
      organisationName: org?.name ?? "your organisation",
      role,
      inviteUrl,
    });

    const emailResult = await sendEmail({ to: email.toLowerCase().trim(), subject, html, text });

    if (!emailResult.ok) {
      return NextResponse.json({ error: "Failed to send invite email. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: `Invite sent to ${email}` });
  } catch (err) {
    console.error("Invite error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
