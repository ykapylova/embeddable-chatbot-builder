import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { env } from "../env";

declare global {
  var __chatbotDbPool: Pool | undefined;
  var __chatbotDb: NodePgDatabase | undefined;
}

function getPool() {
  if (global.__chatbotDbPool) return global.__chatbotDbPool;

  const connectionString = env.databaseUrl;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Configure your database URL.");
  }

  global.__chatbotDbPool = new Pool({
    connectionString,
    ssl:
      connectionString.includes("supabase.co") || connectionString.includes("supabase.com")
        ? { rejectUnauthorized: false }
        : undefined,
  });
  return global.__chatbotDbPool;
}

export function getDb() {
  if (global.__chatbotDb) return global.__chatbotDb;
  global.__chatbotDb = drizzle(getPool());
  return global.__chatbotDb;
}
