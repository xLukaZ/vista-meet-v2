import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { setCookie, deleteCookie, getCookie } from "hono/cookie";
import { z } from "zod";
import { hash, verify } from "@node-rs/argon2";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { tokenService } from "../services/TokenService.js";
import { generateId } from "@meet-vista/core";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env["NODE_ENV"] === "production",
  sameSite: "Strict" as const,
  path: "/",
};

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().min(2).max(64),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const authRoute = new Hono()
  .post("/register", zValidator("json", registerSchema), async (c) => {
    const { email, password, displayName } = c.req.valid("json");

    const existing = await db.select().from(users).where(eq(users.email, email));
    if (existing.length > 0) {
      return c.json({ code: "VALIDATION_ERROR", message: "Email already in use" }, 409);
    }

    const passwordHash = await hash(password);
    const id = generateId("user");

    await db.insert(users).values({ id, email, passwordHash, displayName });

    const accessToken = await tokenService.createAccessToken(id, email);
    const refreshToken = await tokenService.createRefreshToken(id);

    setCookie(c, "access_token", accessToken, { ...COOKIE_OPTS, maxAge: 3600 });
    setCookie(c, "refresh_token", refreshToken, {
      ...COOKIE_OPTS,
      maxAge: 604800,
      path: "/auth/refresh",
    });

    return c.json({ id, email, displayName }, 201);
  })
  .post("/login", zValidator("json", loginSchema), async (c) => {
    const { email, password } = c.req.valid("json");

    const [user] = await db.select().from(users).where(eq(users.email, email));
    // Always hash to mitigate timing-based email enumeration
    const passwordHash = user?.passwordHash ?? "";
    const valid = passwordHash ? await verify(passwordHash, password).catch(() => false) : (await hash(password), false);
    if (!user || !valid) {
      return c.json({ code: "UNAUTHORIZED", message: "Invalid credentials" }, 401);
    }

    const accessToken = await tokenService.createAccessToken(user.id, user.email);
    const refreshToken = await tokenService.createRefreshToken(user.id);

    setCookie(c, "access_token", accessToken, { ...COOKIE_OPTS, maxAge: 3600 });
    setCookie(c, "refresh_token", refreshToken, {
      ...COOKIE_OPTS,
      maxAge: 604800,
      path: "/auth/refresh",
    });

    return c.json({ id: user.id, email: user.email, displayName: user.displayName });
  })
  .post("/refresh", async (c) => {
    const refreshToken = getCookie(c, "refresh_token");
    if (!refreshToken) {
      return c.json({ code: "UNAUTHORIZED", message: "Missing refresh token" }, 401);
    }

    const userId = await tokenService.verifyRefreshToken(refreshToken);
    if (!userId) {
      return c.json({ code: "TOKEN_EXPIRED", message: "Invalid or expired refresh token" }, 401);
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      return c.json({ code: "UNAUTHORIZED", message: "User not found" }, 401);
    }

    const newAccessToken = await tokenService.createAccessToken(user.id, user.email);
    const newRefreshToken = await tokenService.createRefreshToken(user.id);

    setCookie(c, "access_token", newAccessToken, { ...COOKIE_OPTS, maxAge: 3600 });
    setCookie(c, "refresh_token", newRefreshToken, {
      ...COOKIE_OPTS,
      maxAge: 604800,
      path: "/auth/refresh",
    });

    return c.json({ ok: true });
  })
  .post("/logout", async (c) => {
    const refreshToken = getCookie(c, "refresh_token");
    if (refreshToken) {
      const userId = await tokenService.verifyRefreshToken(refreshToken);
      if (userId) await tokenService.revokeUserTokens(userId);
    }

    deleteCookie(c, "access_token");
    deleteCookie(c, "refresh_token");

    return c.json({ ok: true });
  });
