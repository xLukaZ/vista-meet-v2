import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.js";
import { roomService } from "../services/RoomService.js";
import { livekitService } from "../services/LiveKitService.js";
import { generateId, isVistaError } from "@meet-vista/core";

const createRoomSchema = z.object({
  name: z.string().min(2).max(100),
  matterportModelId: z.string().optional(),
});

const updateSettingsSchema = z.object({
  maxParticipants: z.number().int().min(2).max(50).optional(),
  allowGuests: z.boolean().optional(),
  requireApproval: z.boolean().optional(),
  recordingEnabled: z.boolean().optional(),
});

const joinSchema = z.object({
  displayName: z.string().min(2).max(64),
  password: z.string().optional(),
});

const tokenRefreshSchema = z.object({
  participantId: z.string(),
});

export const roomsRoute = new Hono()
  .use("*", authMiddleware)
  .post("/", zValidator("json", createRoomSchema), async (c) => {
    const { name, matterportModelId } = c.req.valid("json");
    const { userId } = c.get("user");

    try {
      const room = await roomService.create(userId, name, matterportModelId);
      return c.json(room, 201);
    } catch (err) {
      if (isVistaError(err)) return c.json(err.toJSON(), 400);
      throw err;
    }
  })
  .get("/", async (c) => {
    const { userId } = c.get("user");
    const userRooms = await roomService.listByOwner(userId);
    return c.json(userRooms);
  })
  .get("/:roomId", async (c) => {
    const roomId = c.req.param("roomId");
    const room = await roomService.getById(roomId);
    if (!room) return c.json({ code: "ROOM_NOT_FOUND", message: "Room not found" }, 404);
    return c.json(room);
  })
  .patch("/:roomId", zValidator("json", updateSettingsSchema), async (c) => {
    const roomId = c.req.param("roomId");
    const { userId } = c.get("user");
    const settings = c.req.valid("json");

    try {
      // Strip undefined values before passing to service (exactOptionalPropertyTypes compat)
      const patch = Object.fromEntries(
        Object.entries(settings).filter(([, v]) => v !== undefined)
      ) as Parameters<typeof roomService.updateSettings>[2];
      await roomService.updateSettings(roomId, userId, patch);
      return c.json({ ok: true });
    } catch (err) {
      if (isVistaError(err)) return c.json(err.toJSON(), err.code === "UNAUTHORIZED" ? 403 : 404);
      throw err;
    }
  })
  .delete("/:roomId", async (c) => {
    const roomId = c.req.param("roomId");
    const { userId } = c.get("user");

    try {
      await roomService.delete(roomId, userId);
      return c.json({ ok: true });
    } catch (err) {
      if (isVistaError(err)) return c.json(err.toJSON(), err.code === "UNAUTHORIZED" ? 403 : 404);
      throw err;
    }
  })
  .post("/:roomId/join", zValidator("json", joinSchema), async (c) => {
    const roomId = c.req.param("roomId");
    const { userId } = c.get("user");
    const { displayName } = c.req.valid("json");

    const room = await roomService.getById(roomId);
    if (!room) return c.json({ code: "ROOM_NOT_FOUND", message: "Room not found" }, 404);

    const role = room.ownerId === userId ? "host" : "guest";
    const participantId = generateId("p");

    let livekitToken: string;
    try {
      livekitToken = await livekitService.generateToken({
        roomId,
        participantId,
        displayName,
        role,
      });
    } catch (err) {
      return c.json({ code: "INTERNAL_ERROR", message: "Failed to generate meeting token" }, 500);
    }

    const sessionId = await roomService.recordJoin(roomId, userId, displayName, role);

    return c.json({ token: sessionId, livekitToken, participantId });
  })
  .post("/:roomId/token/refresh", zValidator("json", tokenRefreshSchema), async (c) => {
    const roomId = c.req.param("roomId");
    const { userId } = c.get("user");
    const { participantId } = c.req.valid("json");

    const room = await roomService.getById(roomId);
    if (!room) return c.json({ code: "ROOM_NOT_FOUND", message: "Room not found" }, 404);

    const role = room.ownerId === userId ? "host" : "guest";

    const livekitToken = await livekitService.generateToken({
      roomId,
      participantId,
      displayName: participantId,
      role,
    });

    return c.json({ token: livekitToken });
  });
