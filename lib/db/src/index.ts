import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { runner } from "node-pg-migrate";
import { fileURLToPath } from "node:url";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function ensureDatabaseMigrations() {
  const client = await pool.connect();

  try {
    await runner({
      dbClient: client,
      dir: fileURLToPath(new URL("../migrations", import.meta.url)),
      direction: "up",
      count: Number.POSITIVE_INFINITY,
      migrationsTable: "pgmigrations",
      schema: "public",
      createSchema: true,
    });
  } finally {
    client.release();
  }
}

await ensureDatabaseMigrations();
export const db = drizzle(pool, { schema });

export * from "./schema";
