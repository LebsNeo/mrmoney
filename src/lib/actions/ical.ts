"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { syncICalFeed, syncAllFeeds } from "@/lib/ical-sync";
import { revalidatePath } from "next/cache";
import { OTAPlatform } from "@prisma/client";

async function getOrgId() {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as any)?.organisationId as string | undefined;
  if (!orgId) throw new Error("Unauthorised");
  return orgId;
}

export async function addICalFeed(input: {
  propertyId: string;
  roomId: string | null;
  platform: OTAPlatform;
  feedName: string;
  icalUrl: string;
}) {
  await getOrgId();
  const feed = await prisma.iCalFeed.create({
    data: {
      propertyId: input.propertyId,
      roomId: input.roomId || null,
      platform: input.platform,
      feedName: input.feedName,
      icalUrl: input.icalUrl,
      isActive: true,
    },
  });
  revalidatePath("/import/ical");
  return { success: true, feedId: feed.id };
}

export async function deleteICalFeed(feedId: string) {
  await getOrgId();
  await prisma.iCalFeed.delete({ where: { id: feedId } });
  revalidatePath("/import/ical");
  return { success: true };
}

export async function triggerFeedSync(feedId: string) {
  await getOrgId();
  const result = await syncICalFeed(feedId);
  revalidatePath("/import/ical");
  revalidatePath("/bookings");
  return result;
}

export async function triggerAllSync(propertyId?: string) {
  await getOrgId();
  const results = await syncAllFeeds(propertyId);
  revalidatePath("/import/ical");
  revalidatePath("/bookings");
  return results;
}
