import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID!;
const META_APP_SECRET = process.env.META_APP_SECRET!;
const GRAPH = "https://graph.facebook.com/v21.0";

async function exchangeCode(code: string, redirectUri: string): Promise<string> {
  const url = new URL(`${GRAPH}/oauth/access_token`);
  url.searchParams.set("client_id", META_APP_ID);
  url.searchParams.set("client_secret", META_APP_SECRET);
  url.searchParams.set("code", code);
  url.searchParams.set("redirect_uri", redirectUri);
  const res = await fetch(url.toString());
  const data = await res.json();
  if (!res.ok || !data.access_token) throw new Error(data.error?.message ?? "Token exchange failed");
  return data.access_token as string;
}

async function getGrantedWabaId(userToken: string): Promise<string | null> {
  const url = new URL(`${GRAPH}/me`);
  url.searchParams.set("fields", "granular_scopes");
  url.searchParams.set("access_token", userToken);
  const res = await fetch(url.toString());
  const data = await res.json();
  const scopes: Array<{ scope: string; target_ids?: string[] }> = data.granular_scopes ?? [];
  for (const s of scopes) {
    if (s.target_ids?.length && (s.scope === "whatsapp_business_management" || s.scope === "whatsapp_business_messaging")) {
      return s.target_ids[0];
    }
  }
  return null;
}

async function getPhoneNumbers(wabaId: string, userToken: string) {
  const url = new URL(`${GRAPH}/${wabaId}/phone_numbers`);
  url.searchParams.set("fields", "id,display_phone_number,verified_name");
  url.searchParams.set("access_token", userToken);
  const res = await fetch(url.toString());
  const data = await res.json();
  return (data.data ?? []) as Array<{ id: string; display_phone_number: string }>;
}

async function subscribeWaba(wabaId: string, userToken: string) {
  await fetch(`${GRAPH}/${wabaId}/subscribed_apps`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_token: userToken }),
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.mrca.co.za";
  const redirectUri = `${appUrl}/api/whatsapp/oauth-callback`;

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}/settings/whatsapp?error=cancelled`);
  }

  try {
    const session = await getServerSession(authOptions);
    const orgId = (session?.user as { organisationId?: string })?.organisationId;
    if (!orgId) return NextResponse.redirect(`${appUrl}/login`);

    const userToken = await exchangeCode(code, redirectUri);
    const wabaId = await getGrantedWabaId(userToken);
    if (!wabaId) return NextResponse.redirect(`${appUrl}/settings/whatsapp?error=no_waba`);

    const phones = await getPhoneNumbers(wabaId, userToken);
    if (!phones.length) return NextResponse.redirect(`${appUrl}/settings/whatsapp?error=no_phone`);

    await subscribeWaba(wabaId, userToken);

    const phone = phones[0];
    await prisma.whatsAppConnection.upsert({
      where: { organisationId: orgId },
      create: { organisationId: orgId, phoneNumberId: phone.id, accessToken: userToken, wabaId, displayPhone: phone.display_phone_number, isActive: true },
      update: { phoneNumberId: phone.id, accessToken: userToken, wabaId, displayPhone: phone.display_phone_number, isActive: true, updatedAt: new Date() },
    });

    return NextResponse.redirect(`${appUrl}/settings/whatsapp?success=1`);
  } catch (err) {
    console.error("oauth-callback error:", err);
    return NextResponse.redirect(`${appUrl}/settings/whatsapp?error=failed`);
  }
}
