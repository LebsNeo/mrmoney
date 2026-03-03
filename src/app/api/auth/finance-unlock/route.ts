import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { compare } from "bcryptjs";
import { sign } from "@/lib/finance-token";

const IS_PROD = process.env.NODE_ENV === "production";

function setCookie(res: NextResponse, token: string) {
  res.cookies.set("finance_unlocked", token, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: IS_PROD ? "none" : "lax",
    path: "/",
    maxAge: 60 * 60 * 8, // 8 hours
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as { organisationId?: string })?.organisationId;
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pin } = await req.json();
  if (!pin || typeof pin !== "string") {
    return NextResponse.json({ error: "PIN required" }, { status: 400 });
  }

  const org = await prisma.$queryRaw<Array<{ financePin: string | null }>>`
    SELECT "financePin" FROM organisations WHERE id = ${orgId}
  `;

  const storedHash = org[0]?.financePin;

  // If no PIN set — auto-unlock for everyone
  if (!storedHash) {
    const token = sign(orgId);
    const res = NextResponse.json({ ok: true });
    setCookie(res, token);
    return res;
  }

  // Auto-unlock request but PIN is set — reject
  if (pin === "__auto__") {
    return NextResponse.json({ error: "PIN required" }, { status: 401 });
  }

  const valid = await compare(pin, storedHash);
  if (!valid) {
    return NextResponse.json({ error: "Incorrect PIN" }, { status: 401 });
  }

  const token = sign(orgId);
  const res = NextResponse.json({ ok: true });
  setCookie(res, token);
  return res;
}
