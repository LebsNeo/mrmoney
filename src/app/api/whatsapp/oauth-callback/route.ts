import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID!;
const META_APP_SECRET = process.env.META_APP_SECRET!;
const GRAPH = "https://graph.facebook.com/v21.0";

async function exchangeCode(code: string, redirectUri: string): Promise<{ token: string; wabaId?: string }> {
  const url = new URL(`${GRAPH}/oauth/access_token`);
  url.searchParams.set("client_id", META_APP_ID.trim());
  url.searchParams.set("client_secret", META_APP_SECRET.trim());
  url.searchParams.set("code", code);
  url.searchParams.set("redirect_uri", redirectUri);
  console.log("exchange URL:", url.toString().replace(META_APP_SECRET.trim(), "***"));
  const res = await fetch(url.toString());
  const data = await res.json();
  console.log("exchange response:", JSON.stringify(data).substring(0, 500));
  if (!res.ok || !data.access_token) throw new Error(data.error?.message ?? "Token exchange failed");
  // Embedded signup sometimes returns waba_id or data_access_expiration_time in the response
  const wabaId: string | undefined = data.waba_id ?? data.whatsapp_business_id ?? undefined;
  if (wabaId) console.log("WABA ID from exchange:", wabaId);
  return { token: data.access_token as string, wabaId };
}

async function getGrantedWabaId(userToken: string): Promise<string | null> {
  // Strategy 0: debug_token reveals all granted scopes including WABA targets
  const appToken = `${META_APP_ID.trim()}|${META_APP_SECRET.trim()}`;
  const urlDebug = new URL(`${GRAPH}/debug_token`);
  urlDebug.searchParams.set("input_token", userToken);
  urlDebug.searchParams.set("access_token", appToken);
  const resDebug = await fetch(urlDebug.toString());
  const dataDebug = await resDebug.json();
  console.log("debug_token response:", JSON.stringify(dataDebug?.data ?? dataDebug).substring(0, 600));
  const granularDebug: Array<{ scope: string; target_ids?: string[] }> = dataDebug?.data?.granular_scopes ?? [];
  for (const s of granularDebug) {
    if (s.target_ids?.length && (s.scope === "whatsapp_business_management" || s.scope === "whatsapp_business_messaging")) {
      console.log("WABA from debug_token:", s.target_ids[0]);
      return s.target_ids[0];
    }
  }

  // Strategy 1: granular_scopes (works when WABA explicitly granted via embedded signup)
  const url1 = new URL(`${GRAPH}/me`);
  url1.searchParams.set("fields", "granular_scopes");
  url1.searchParams.set("access_token", userToken);
  const res1 = await fetch(url1.toString());
  const data1 = await res1.json();
  console.log("granular_scopes response:", JSON.stringify(data1).substring(0, 400));
  const scopes: Array<{ scope: string; target_ids?: string[] }> = data1.granular_scopes ?? [];
  for (const s of scopes) {
    if (s.target_ids?.length && (s.scope === "whatsapp_business_management" || s.scope === "whatsapp_business_messaging")) {
      return s.target_ids[0];
    }
  }

  // Strategy 2: look up WABAs via /me/businesses
  console.log("granular_scopes empty — falling back to /me/businesses");
  const url2 = new URL(`${GRAPH}/me/businesses`);
  url2.searchParams.set("fields", "id,name,owned_whatsapp_business_accounts{id,name}");
  url2.searchParams.set("access_token", userToken);
  const res2 = await fetch(url2.toString());
  const data2 = await res2.json();
  console.log("businesses response:", JSON.stringify(data2).substring(0, 400));
  const businesses: Array<{ id: string; owned_whatsapp_business_accounts?: { data: Array<{ id: string }> } }> = data2.data ?? [];
  for (const biz of businesses) {
    const wabas = biz.owned_whatsapp_business_accounts?.data ?? [];
    if (wabas.length) return wabas[0].id;
  }

  // Strategy 3: direct WABA lookup via /me/whatsapp_business_accounts
  console.log("businesses empty — falling back to /me/whatsapp_business_accounts");
  const url3 = new URL(`${GRAPH}/me/whatsapp_business_accounts`);
  url3.searchParams.set("access_token", userToken);
  const res3 = await fetch(url3.toString());
  const data3 = await res3.json();
  console.log("whatsapp_business_accounts response:", JSON.stringify(data3).substring(0, 400));
  const wabas3: Array<{ id: string }> = data3.data ?? [];
  if (wabas3.length) return wabas3[0].id;

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
  const appUrl = "https://www.mrca.co.za";
  const redirectUri = `${appUrl}/api/whatsapp/oauth-callback`;

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}/settings/whatsapp?error=cancelled`);
  }

  try {
    const session = await getServerSession(authOptions);
    const orgId = (session?.user as { organisationId?: string })?.organisationId;
    if (!orgId) return NextResponse.redirect(`${appUrl}/login`);

    const { token: userToken, wabaId: exchangeWabaId } = await exchangeCode(code, redirectUri);
    const wabaId = exchangeWabaId ?? await getGrantedWabaId(userToken);
    if (!wabaId) {
      console.log("All WABA strategies failed — no_waba");
      return NextResponse.redirect(`${appUrl}/settings/whatsapp?error=no_waba`);
    }

    const phones = await getPhoneNumbers(wabaId, userToken);
    if (!phones.length) return NextResponse.redirect(`${appUrl}/settings/whatsapp?error=no_phone`);

    await subscribeWaba(wabaId, userToken);

    const phone = phones[0];
    const existingConn = await prisma.whatsAppConnection.findFirst({
      where: { OR: [{ phoneNumberId: phone.id }, { organisationId: orgId }] },
    });
    if (existingConn) {
      await prisma.whatsAppConnection.update({
        where: { id: existingConn.id },
        data: { organisationId: orgId, phoneNumberId: phone.id, accessToken: userToken, wabaId, displayPhone: phone.display_phone_number, isActive: true, updatedAt: new Date() },
      });
    } else {
      await prisma.whatsAppConnection.create({
        data: { organisationId: orgId, phoneNumberId: phone.id, accessToken: userToken, wabaId, displayPhone: phone.display_phone_number, isActive: true },
      });
    }

    return NextResponse.redirect(`${appUrl}/settings/whatsapp?success=1`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("oauth-callback error FULL:", msg);
    return NextResponse.redirect(`${appUrl}/settings/whatsapp?error=failed&msg=${encodeURIComponent(msg)}`);
  }
}
