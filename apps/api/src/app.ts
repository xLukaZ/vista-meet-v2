import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import type { MiddlewareHandler } from "hono";
import { healthRoute } from "./routes/health.js";
import { authRoute } from "./routes/auth.js";
import { roomsRoute } from "./routes/rooms.js";
import { sessionsRoute } from "./routes/sessions.js";
import { devRoute } from "./routes/dev.js";

const corsOrigin = (process.env["CORS_ORIGIN"] ?? "http://localhost:3000,http://localhost:5173")
  .split(",")
  .map((o) => o.trim());

// Simple in-process rate limiter: 30 requests/min per IP on auth endpoints
const authHits = new Map<string, { count: number; reset: number }>();
const authLimiter: MiddlewareHandler = async (c, next) => {
  const ip = c.req.header("x-forwarded-for") ?? c.req.header("cf-connecting-ip") ?? "unknown";
  const now = Date.now();
  const entry = authHits.get(ip);
  if (!entry || entry.reset < now) {
    authHits.set(ip, { count: 1, reset: now + 60_000 });
  } else if (entry.count >= 30) {
    return c.json({ code: "RATE_LIMITED", message: "Zu viele Anfragen, bitte warten." }, 429);
  } else {
    entry.count++;
  }
  return next();
};

export const app = new Hono()
  .use("*", honoLogger())
  .use("*", secureHeaders())
  .use(
    "*",
    cors({
      origin: corsOrigin,
      credentials: true,
      allowMethods: ["GET", "POST", "PATCH", "DELETE"],
      allowHeaders: ["Content-Type", "Authorization", "x-dev-secret"],
    })
  )
  .route("/health", healthRoute)
  .use("/auth/*", authLimiter)
  .route("/auth", authRoute)
  .route("/rooms", roomsRoute)
  .route("/sessions", sessionsRoute)
  .route("/dev", devRoute);

export type AppType = typeof app;
