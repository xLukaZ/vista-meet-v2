import { generateId, generateSlug, createError } from "@meet-vista/core";
import type { Room, RoomSettings } from "@meet-vista/core";
import { db } from "../db/client.js";
import { rooms, sessions } from "../db/schema.js";
import { eq, and } from "drizzle-orm";

const DEFAULT_SETTINGS: RoomSettings = {
  maxParticipants: 10,
  allowGuests: true,
  requireApproval: false,
  recordingEnabled: false,
};

function rowToRoom(r: {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  matterportModelId: string | null;
  settings: RoomSettings | null;
  createdAt: Date | null;
}): Room {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    ownerId: r.ownerId,
    settings: r.settings ?? DEFAULT_SETTINGS,
    createdAt: r.createdAt?.toISOString() ?? new Date().toISOString(),
    ...(r.matterportModelId !== null ? { matterportModelId: r.matterportModelId } : {}),
  };
}

export class RoomService {
  async create(ownerId: string, name: string, matterportModelId?: string): Promise<Room> {
    const id = generateId("room");
    const slug = generateSlug(name);

    await db.insert(rooms).values({
      id,
      name,
      slug,
      ownerId,
      matterportModelId: matterportModelId ?? null,
    });

    const room = await this.getById(id);
    if (!room) throw createError("INTERNAL_ERROR", "Failed to create room");
    return room;
  }

  async getById(id: string): Promise<Room | null> {
    const [row] = await db.select().from(rooms).where(eq(rooms.id, id));
    if (!row) return null;
    return rowToRoom(row);
  }

  async listByOwner(ownerId: string): Promise<Room[]> {
    const rows = await db.select().from(rooms).where(eq(rooms.ownerId, ownerId));
    return rows.map(rowToRoom);
  }

  async updateSettings(
    id: string,
    ownerId: string,
    settings: Partial<RoomSettings>
  ): Promise<void> {
    const room = await this.getById(id);
    if (!room) throw createError("ROOM_NOT_FOUND", `Room ${id} not found`);
    if (room.ownerId !== ownerId)
      throw createError("UNAUTHORIZED", "Only the host can modify room settings");

    await db
      .update(rooms)
      .set({ settings: { ...room.settings, ...settings } })
      .where(and(eq(rooms.id, id), eq(rooms.ownerId, ownerId)));
  }

  async delete(id: string, ownerId: string): Promise<void> {
    const room = await this.getById(id);
    if (!room) throw createError("ROOM_NOT_FOUND", `Room ${id} not found`);
    if (room.ownerId !== ownerId)
      throw createError("UNAUTHORIZED", "Only the host can delete a room");

    await db.delete(rooms).where(eq(rooms.id, id));
  }

  async recordJoin(
    roomId: string,
    userId: string,
    displayName: string,
    role: "host" | "guest"
  ): Promise<string> {
    const sessionId = generateId("session");
    await db.insert(sessions).values({
      id: sessionId,
      roomId,
      userId,
      displayName,
      role,
    });
    return sessionId;
  }

  async recordLeave(sessionId: string): Promise<void> {
    await db.update(sessions).set({ leftAt: new Date() }).where(eq(sessions.id, sessionId));
  }
}

export const roomService = new RoomService();
