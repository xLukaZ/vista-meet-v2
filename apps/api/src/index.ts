import { serve } from "@hono/node-server";
import { app } from "./app.js";
import { logger } from "./lib/logger.js";

if (!process.env["JWT_SECRET"]) throw new Error("JWT_SECRET env var is required");

const port = Number(process.env["PORT"] ?? 3001);

serve({ fetch: app.fetch, port }, () => {
  logger.info({ port }, "Vista Meet API started");
});
