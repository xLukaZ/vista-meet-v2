import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema.js";
import * as path from "node:path";
import * as fs from "node:fs";

const dbUrl = process.env["DATABASE_URL"] ?? "./data/vista.db";

// Ensure data directory exists
const dbPath = dbUrl.startsWith("file:") ? dbUrl.slice(5) : dbUrl;
if (!dbPath.startsWith(":memory:")) {
  fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
}

const client = createClient({
  url: dbUrl.startsWith("file:") || dbUrl.startsWith(":") ? dbUrl : `file:${dbUrl}`,
});

export const db = drizzle(client, { schema });
export type Db = typeof db;
