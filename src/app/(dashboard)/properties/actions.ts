"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { RoomType, RoomStatus } from "@prisma/client";

export interface AddRoomInput {
  name: string;
  description?: string;
  type: RoomType;
  baseRate: number;
  maxOccupancy: number;
}

export async function addRoom(propertyId: string, data: AddRoomInput) {
  try {
    await prisma.room.create({
      data: {
        propertyId,
        name: data.name,
        description: data.description ?? null,
        type: data.type,
        baseRate: data.baseRate,
        maxOccupancy: data.maxOccupancy,
        status: RoomStatus.ACTIVE,
      },
    });
    revalidatePath("/properties");
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: msg };
  }
}

export async function toggleRoomStatus(roomId: string) {
  try {
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) return { success: false, message: "Room not found" };

    const newStatus =
      room.status === RoomStatus.ACTIVE ? RoomStatus.INACTIVE : RoomStatus.ACTIVE;

    await prisma.room.update({
      where: { id: roomId },
      data: { status: newStatus },
    });

    revalidatePath("/properties");
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: msg };
  }
}

export async function updateRoom(
  roomId: string,
  data: Partial<AddRoomInput>
) {
  try {
    await prisma.room.update({
      where: { id: roomId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.baseRate !== undefined && { baseRate: data.baseRate }),
        ...(data.maxOccupancy !== undefined && { maxOccupancy: data.maxOccupancy }),
      },
    });
    revalidatePath("/properties");
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: msg };
  }
}
