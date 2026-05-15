import { migrate } from "drizzle-orm/libsql/migrator";
import { db } from "./client.js";

await migrate(db, { migrationsFolder: "./drizzle" });
console.warn("Migrations applied successfully");
