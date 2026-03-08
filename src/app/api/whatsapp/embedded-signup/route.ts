import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID!;
const META_APP_SECRET = process.env.META_APP_SECRET!;
const GRAPH_VERSION = "v21.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

/** Exchange the short-lived code for a user access token */
async function exchangeCode(code: string): Promise<string> {
  const url = new URL(`${GRAPH}/oauth/access_token`);
  url.searchParams.set("client_id", META_APP_ID);
  url.searchParams.set("client_secret", META_APP_SECRET);
  url.searchParams.set("code", code);

  const res = await fetch(url.toString());
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(data.error?.message ?? "Failed to exchange code for token");
  }
  return data.access_token as string;
}

/**
 * Use the granular scopes on the user token to find which WABA was granted.
 * Meta populates target_ids for whatsapp_business_management / whatsapp_business_messaging.
 */
async function getGrantedWabaId(userToken: string): Promise<string | null> {
  const url = new URL(`${GRAPH}/me`);
  url.searchParams.set("fields", "granular_scopes");
  url.searchParams.set("access_token", userToken);

  const res = await fetch(url.toString());
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? "Failed to get granular scopes");

  const scopes: Array<{ scope: string; target_ids?: string[] }> = data.granular_scopes ?? [];
  for (const s of scopes) {
    if (
      (s.scope === "whatsapp_business_management" || s.scope === "whatsapp_business_messaging") &&
      s.target_ids?.length
    ) {
      return s.target_ids[0];
    }
  }
  return null;
}

/** Get phone numbers registered to a WABA */
async function getPhoneNumbers(
  wabaId: string,
  userToken: string
): Promise<Array<{ id: string; display_phone_number: string; verified_name: string }>> {
  const url = new URL(`${GRAPH}/${wabaId}/phone_numbers`);
  url.searchParams.set("fields", "id,display_phone_number,verified_name");
  url.searchParams.set("access_token", userToken);

  const res = await fetch(url.toString());
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? "Failed to get phone numbers");
  return data.data ?? [];
}

/** Subscribe the WABA to our app so we receive webhooks */
async function subscribeWabaToApp(wabaId: string, userToken: string): Promise<void> {
  const url = new URL(`${GRAPH}/${wabaId}/subscribed_apps`);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_token: userToken }),
  });
  if (!res.ok) {
    const data = await res.json();
    console.warn("subscribeWabaToApp warning:", data.error?.message);
    // non-fatal — continue
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const orgId = (session?.user as { organisationId?: string })?.organisationId;
    if (!orgId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

    const body = await req.json();
    const code: string | undefined = body.code;
    if (!code) return NextResponse.json({ error: "code is required" }, { status: 400 });

    // 1. Exchange code → user access token
    const userToken = await exchangeCode(code);

    // 2. Find the WABA the user granted us access to
    const wabaId = await getGrantedWabaId(userToken);
    if (!wabaId) {
      return NextResponse.json(
        { error: "No WhatsApp Business Account found. Please complete the signup and grant access to your WABA." },
        { status: 422 }
      );
    }

    // 3. Get phone numbers on this WABA
    const phones = await getPhoneNumbers(wabaId, userToken);
    if (!phones.length) {
      return NextResponse.json(
        { error: "No phone numbers found on your WhatsApp Business Account. Please add one in Meta Business Manager." },
        { status: 422 }
      );
    }

    // 4. Subscribe WABA to our app (best-effort)
    await subscribeWabaToApp(wabaId, userToken);

    // 5. Use first phone (most signups have one)
    const phone = phones[0];

    // 6. Save to DB — look up by phoneNumberId OR organisationId to avoid unique conflicts
    const existing = await prisma.whatsAppConnection.findFirst({
      where: { OR: [{ phoneNumberId: phone.id }, { organisationId: orgId }] },
    });
    if (existing) {
      await prisma.whatsAppConnection.update({
        where: { id: existing.id },
        data: {
          organisationId: orgId,
          phoneNumberId: phone.id,
          accessToken: userToken,
          wabaId,
          displayPhone: phone.display_phone_number,
          isActive: true,
          updatedAt: new Date(),
        },
      });
    } else {
      await prisma.whatsAppConnection.create({
        data: {
          organisationId: orgId,
          phoneNumberId: phone.id,
          accessToken: userToken,
          wabaId,
          displayPhone: phone.display_phone_number,
          isActive: true,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      phoneNumberId: phone.id,
      displayPhone: phone.display_phone_number,
      wabaId,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unexpected error";
    console.error("embedded-signup error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
