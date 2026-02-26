"use server";

import { prisma } from "@/lib/prisma";
import { PropertyType, RoomType } from "@prisma/client";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";

export interface OnboardingRoom {
  name: string;
  type: string;
  baseRate: number;
}

export interface OnboardingOTA {
  platform: string;
  commission: number;
}

export interface OnboardingData {
  // Property
  propertyName: string;
  propertyType: string;
  city: string;
  vatRegistered: boolean;
  vatNumber?: string;
  // Rooms
  rooms: OnboardingRoom[];
  // OTAs
  otas: OnboardingOTA[];
  // User (if creating from session, pass userId/orgId)
  userId?: string;
  organisationId?: string;
}

export async function createPropertyFromOnboarding(data: OnboardingData) {
  try {
    // Map propertyType string to enum
    const propertyTypeMap: Record<string, PropertyType> = {
      Guesthouse: PropertyType.GUESTHOUSE,
      Hotel: PropertyType.HOTEL,
      Lodge: PropertyType.LODGE,
      Boutique: PropertyType.BOUTIQUE,
      "Airbnb Portfolio": PropertyType.AIRBNB_PORTFOLIO,
    };

    const roomTypeMap: Record<string, RoomType> = {
      single: RoomType.SINGLE,
      double: RoomType.DOUBLE,
      twin: RoomType.TWIN,
      queen: RoomType.QUEEN,
      king: RoomType.KING,
      suite: RoomType.SUITE,
      dorm: RoomType.DORM,
    };

    let organisationId = data.organisationId;
    let userId = data.userId;

    await prisma.$transaction(async (tx) => {
      // Create org if not provided
      if (!organisationId) {
        const slug = data.propertyName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") + "-" + Date.now();

        const org = await tx.organisation.create({
          data: {
            name: data.propertyName,
            slug,
            vatRegistered: data.vatRegistered,
            vatNumber: data.vatNumber ?? null,
          },
        });
        organisationId = org.id;
      }

      // Create user if not provided
      if (!userId && organisationId) {
        // Default demo user for onboarding (will be replaced with real auth later)
        const existing = await tx.user.findFirst({
          where: { organisationId },
        });
        if (!existing) {
          const hash = await bcrypt.hash("changeme123", 10);
          const user = await tx.user.create({
            data: {
              organisationId,
              email: `owner@${data.propertyName.toLowerCase().replace(/[^a-z0-9]/g, "")}.co.za`,
              name: "Property Owner",
              passwordHash: hash,
            },
          });
          userId = user.id;
        } else {
          userId = existing.id;
        }
      }

      // Create property
      const property = await tx.property.create({
        data: {
          organisationId: organisationId!,
          name: data.propertyName,
          type: propertyTypeMap[data.propertyType] ?? PropertyType.GUESTHOUSE,
          city: data.city,
        },
      });

      // Create rooms
      for (const room of data.rooms) {
        await tx.room.create({
          data: {
            propertyId: property.id,
            name: room.name,
            type: roomTypeMap[room.type.toLowerCase()] ?? RoomType.DOUBLE,
            baseRate: room.baseRate,
          },
        });
      }
    });
  } catch (err) {
    console.error("Onboarding error:", err);
    throw new Error(err instanceof Error ? err.message : "Failed to create property");
  }

  redirect("/dashboard");
}
