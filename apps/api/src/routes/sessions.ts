import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import { roomService } from "../services/RoomService.js";
import { db } from "../db/client.js";
import { sessions } from "../db/schema.js";
import { eq, and, isNull } from "drizzle-orm";

export const sessionsRoute = new Hono()
  .use("*", authMiddleware)
  .post("/:sessionId/leave", async (c) => {
    const sessionId = c.req.param("sessionId");
    await roomService.recordLeave(sessionId);
    return c.json({ ok: true });
  })
  .get("/:sessionId/participants", async (c) => {
    const sessionId = c.req.param("sessionId");
    const { userId } = c.get("user");

    const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId));
    if (!session) {
      return c.json({ code: "ROOM_NOT_FOUND", message: "Session not found" }, 404);
    }

    // Only participants of this room can see the participant list
    const [membership] = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.roomId, session.roomId), eq(sessions.userId, userId)));
    if (!membership) {
      return c.json({ code: "FORBIDDEN", message: "Access denied" }, 403);
    }

    const active = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.roomId, session.roomId), isNull(sessions.leftAt)));

    return c.json(
      active.map((s) => ({
        userId: s.userId,
        displayName: s.displayName,
        role: s.role,
        joinedAt: s.joinedAt?.toISOString(),
      }))
    );
  });
