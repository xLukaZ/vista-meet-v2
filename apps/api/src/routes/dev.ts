import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { livekitService } from "../services/LiveKitService.js";
import { generateId } from "@meet-vista/core";
import { db } from "../db/client.js";
import { devRoomConfig as devRoomConfigTable } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";

const isProd = process.env["NODE_ENV"] === "production";

// Meeting names stored in-memory (roomId → name).
// The SQLite devRoomConfig table does not have a meeting_name column to keep
// migrations backward-compatible. Names survive process uptime but not restarts —
// that is acceptable since guests use the token (UUID) to join.
const meetingNames = new Map<string, string>();

// Host secrets stored in-memory (roomId → hostSecret).
// Generated on meeting creation, validated on all host action endpoints.
const roomSecrets = new Map<string, string>();

function generateSecret(): string {
  return randomBytes(24).toString("hex");
}

function checkHostSecret(roomId: string, provided: string | undefined): boolean {
  const expected = roomSecrets.get(roomId);
  if (!expected) return false;
  return expected === provided;
}

async function getRoomConfig(roomId: string) {
  const row = await db.select().from(devRoomConfigTable).where(eq(devRoomConfigTable.roomId, roomId)).get();
  return row ?? { roomId, requireApproval: false, closed: false };
}

async function upsertRoomConfig(roomId: string, patch: { requireApproval?: boolean; closed?: boolean }) {
  const current = await getRoomConfig(roomId);
  await db.insert(devRoomConfigTable).values({
    roomId,
    requireApproval: patch.requireApproval ?? current.requireApproval,
    closed: patch.closed ?? current.closed,
  }).onConflictDoUpdate({
    target: devRoomConfigTable.roomId,
    set: {
      requireApproval: patch.requireApproval ?? current.requireApproval,
      closed: patch.closed ?? current.closed,
    },
  });
}

// Base schema that all host-action endpoints extend.
const hostActionBase = z.object({
  roomId: z.string().min(1),
  hostSecret: z.string().min(1),
});

const createMeetingSchema = z.object({
  meetingName: z.string().min(1).max(100),
  displayName: z.string().min(1).max(64),
  requireApproval: z.boolean().optional().default(false),
});

const guestSchema = z.object({
  roomId: z.string().min(1),
  displayName: z.string().min(1).max(64),
});

const kickSchema = hostActionBase.extend({
  participantIdentity: z.string().min(1),
});

const muteSchema = hostActionBase.extend({
  participantIdentity: z.string().min(1),
  muted: z.boolean(),
});

const screenshareSchema = hostActionBase.extend({
  participantIdentity: z.string().min(1),
  allowed: z.boolean(),
});

const admitSchema = hostActionBase.extend({
  participantIdentity: z.string().min(1),
});

const denySchema = hostActionBase.extend({
  participantIdentity: z.string().min(1),
});

const roomConfigSchema = hostActionBase.extend({
  closed: z.boolean(),
});

const cameraSchema = hostActionBase.extend({
  participantIdentity: z.string().min(1),
  cameraOff: z.boolean(),
});

const endMeetingSchema = hostActionBase;

export const devRoute = new Hono()

  .post("/create-meeting", zValidator("json", createMeetingSchema), async (c) => {
    if (isProd) return c.json({ code: "UNAUTHORIZED", message: "Not available in production" }, 403);

    const { meetingName, displayName, requireApproval } = c.req.valid("json");
    const meetingToken = generateId("meet");
    const hostSecret = generateSecret();

    meetingNames.set(meetingToken, meetingName);
    roomSecrets.set(meetingToken, hostSecret);

    await upsertRoomConfig(meetingToken, { requireApproval: requireApproval ?? false });

    const participantId = generateId("host");
    const livekitToken = await livekitService.generateToken({
      roomId: meetingToken,
      participantId,
      displayName,
      role: "host",
    });

    return c.json({ meetingToken, meetingName, livekitToken, participantId, role: "host", hostSecret });
  })

  .get("/room-info/:meetingToken", async (c) => {
    if (isProd) return c.json({ code: "UNAUTHORIZED", message: "Not available in production" }, 403);

    const meetingToken = c.req.param("meetingToken");
    const config = await getRoomConfig(meetingToken);
    const name = meetingNames.get(meetingToken) ?? "";
    const exists = !!(await db.select().from(devRoomConfigTable).where(eq(devRoomConfigTable.roomId, meetingToken)).get());
    return c.json({
      exists,
      meetingName: name,
      requireApproval: config.requireApproval,
      closed: config.closed,
    });
  })

  .post("/guest-token", zValidator("json", guestSchema), async (c) => {
    if (isProd) return c.json({ code: "UNAUTHORIZED", message: "Not available in production" }, 403);

    const { roomId, displayName } = c.req.valid("json");

    const existingConfig = await getRoomConfig(roomId);
    if (existingConfig.closed) {
      return c.json({ code: "ROOM_CLOSED", message: "Dieser Raum ist geschlossen." }, 403);
    }

    const participantId = generateId("guest");
    const effectiveRole = existingConfig.requireApproval ? "waiting" : "guest";

    const livekitToken = await livekitService.generateToken({
      roomId,
      participantId,
      displayName,
      role: effectiveRole,
    });

    return c.json({
      livekitToken,
      participantId,
      sessionId: participantId,
      role: effectiveRole,
      meetingName: meetingNames.get(roomId) ?? "",
    });
  })

  .post("/kick", zValidator("json", kickSchema), async (c) => {
    if (isProd) return c.json({ code: "UNAUTHORIZED", message: "Not available" }, 403);

    const { roomId, participantIdentity, hostSecret } = c.req.valid("json");
    if (!checkHostSecret(roomId, hostSecret)) {
      return c.json({ code: "UNAUTHORIZED", message: "Ungültiges Host-Secret" }, 403);
    }

    await livekitService.removeParticipant(roomId, participantIdentity);

    return c.json({ ok: true });
  })

  .post("/mute-participant", zValidator("json", muteSchema), async (c) => {
    if (isProd) return c.json({ code: "UNAUTHORIZED", message: "Not available" }, 403);

    const { roomId, participantIdentity, muted, hostSecret } = c.req.valid("json");
    if (!checkHostSecret(roomId, hostSecret)) {
      return c.json({ code: "UNAUTHORIZED", message: "Ungültiges Host-Secret" }, 403);
    }

    await livekitService.muteParticipant(roomId, participantIdentity, muted);

    return c.json({ ok: true });
  })

  .post("/screenshare-permission", zValidator("json", screenshareSchema), async (c) => {
    if (isProd) return c.json({ code: "UNAUTHORIZED", message: "Not available" }, 403);

    const { roomId, participantIdentity, allowed, hostSecret } = c.req.valid("json");
    if (!checkHostSecret(roomId, hostSecret)) {
      return c.json({ code: "UNAUTHORIZED", message: "Ungültiges Host-Secret" }, 403);
    }

    await livekitService.setScreenShareAllowed(roomId, participantIdentity, allowed);

    return c.json({ ok: true });
  })

  .post("/admit-participant", zValidator("json", admitSchema), async (c) => {
    if (isProd) return c.json({ code: "UNAUTHORIZED", message: "Not available" }, 403);

    const { roomId, participantIdentity, hostSecret } = c.req.valid("json");
    if (!checkHostSecret(roomId, hostSecret)) {
      return c.json({ code: "UNAUTHORIZED", message: "Ungültiges Host-Secret" }, 403);
    }

    await livekitService.admitParticipant(roomId, participantIdentity);

    return c.json({ ok: true });
  })

  .post("/deny-participant", zValidator("json", denySchema), async (c) => {
    if (isProd) return c.json({ code: "UNAUTHORIZED", message: "Not available" }, 403);

    const { roomId, participantIdentity, hostSecret } = c.req.valid("json");
    if (!checkHostSecret(roomId, hostSecret)) {
      return c.json({ code: "UNAUTHORIZED", message: "Ungültiges Host-Secret" }, 403);
    }

    // Notify the guest before kicking so they can show "access denied" screen
    try {
      await livekitService.sendData(roomId, { type: "denied" }, [participantIdentity]);
    } catch { /* participant may not be subscribed yet, continue anyway */ }

    await livekitService.removeParticipant(roomId, participantIdentity);

    return c.json({ ok: true });
  })

  .get("/room-config/:roomId", async (c) => {
    if (isProd) return c.json({ code: "UNAUTHORIZED", message: "Not available" }, 403);

    const roomId = c.req.param("roomId");
    const config = await getRoomConfig(roomId);
    return c.json({ ...config, meetingName: meetingNames.get(roomId) ?? "" });
  })

  .post("/set-room-config", zValidator("json", roomConfigSchema), async (c) => {
    if (isProd) return c.json({ code: "UNAUTHORIZED", message: "Not available" }, 403);

    const { roomId, closed, hostSecret } = c.req.valid("json");
    if (!checkHostSecret(roomId, hostSecret)) {
      return c.json({ code: "UNAUTHORIZED", message: "Ungültiges Host-Secret" }, 403);
    }

    await upsertRoomConfig(roomId, { closed });

    return c.json({ ok: true });
  })

  .post("/end-meeting", zValidator("json", endMeetingSchema), async (c) => {
    if (isProd) return c.json({ code: "UNAUTHORIZED", message: "Not available" }, 403);

    const { roomId, hostSecret } = c.req.valid("json");
    if (!checkHostSecret(roomId, hostSecret)) {
      return c.json({ code: "UNAUTHORIZED", message: "Ungültiges Host-Secret" }, 403);
    }

    // Notify all participants before deleting the room
    try {
      await livekitService.sendData(roomId, { type: "meeting_ended" });
    } catch { /* room may already be empty */ }

    try {
      await livekitService.deleteRoom(roomId);
    } catch {
      // Room may already be empty/gone
    }
    await upsertRoomConfig(roomId, { closed: true });
    roomSecrets.delete(roomId);

    return c.json({ ok: true });
  })

  .post("/camera-participant", zValidator("json", cameraSchema), async (c) => {
    if (isProd) return c.json({ code: "UNAUTHORIZED", message: "Not available" }, 403);

    const { roomId, participantIdentity, cameraOff, hostSecret } = c.req.valid("json");
    if (!checkHostSecret(roomId, hostSecret)) {
      return c.json({ code: "UNAUTHORIZED", message: "Ungültiges Host-Secret" }, 403);
    }

    await livekitService.muteCameraParticipant(roomId, participantIdentity, cameraOff);

    return c.json({ ok: true });
  });
