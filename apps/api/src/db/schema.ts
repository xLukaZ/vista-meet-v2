import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import type { RoomSettings } from "@meet-vista/core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const rooms = sqliteTable("rooms", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  matterportModelId: text("mp_model_id"),
  settings: text("settings", { mode: "json" })
    .$type<RoomSettings>()
    .$defaultFn(() => ({
      maxParticipants: 10,
      allowGuests: true,
      requireApproval: false,
      recordingEnabled: false,
    })),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  roomId: text("room_id")
    .notNull()
    .references(() => rooms.id),
  userId: text("user_id").notNull(),
  displayName: text("display_name").notNull(),
  role: text("role", { enum: ["host", "guest", "viewer"] }).notNull(),
  joinedAt: integer("joined_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  leftAt: integer("left_at", { mode: "timestamp" }),
});

export const refreshTokens = sqliteTable("refresh_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const devRoomConfig = sqliteTable("dev_room_config", {
  roomId: text("room_id").primaryKey(),
  requireApproval: integer("require_approval", { mode: "boolean" }).notNull().default(false),
  closed: integer("closed", { mode: "boolean" }).notNull().default(false),
});
