import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { env } from "../env";

declare global {
  var __chatbotDbPool: Pool | undefined;
  var __chatbotDb: NodePgDatabase | undefined;
}

/** Small on purpose — see the comment on `max` below. */
const POOL_MAX_CONNECTIONS = 3;

function isSupabaseHost(connectionString: string): boolean {
  return connectionString.includes("supabase.co") || connectionString.includes("supabase.com");
}

function getPool() {
  if (global.__chatbotDbPool) return global.__chatbotDbPool;

  const connectionString = env.databaseUrl;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Configure your database URL.");
  }

  global.__chatbotDbPool = new Pool({
    connectionString,
    // Every warm serverless instance holds its own pool, so `pg`'s default of
    // 10 is 10 *per instance* — under a spike that exhausts Supabase's pooler
    // and every route 500s at once with "remaining connection slots are
    // reserved". A request uses one connection at a time; a small ceiling is
    // what keeps the total bounded as instances multiply.
    max: POOL_MAX_CONNECTIONS,
    idleTimeoutMillis: 10_000,
    // Fail fast rather than queue behind an exhausted pooler: a request that
    // cannot get a connection in five seconds has already lost the visitor.
    connectionTimeoutMillis: 5_000,
    // Supabase serves a certificate that does not chain to Node's default
    // trust store, so verification is off here deliberately rather than by
    // inheritance. The connection is still encrypted; what is not checked is
    // the certificate's chain, and the host is a fixed value from our own
    // environment, not something a request can influence.
    ssl: isSupabaseHost(connectionString) ? { rejectUnauthorized: false } : undefined,
  });
  return global.__chatbotDbPool;
}

export function getDb() {
  if (global.__chatbotDb) return global.__chatbotDb;
  global.__chatbotDb = drizzle(getPool());
  return global.__chatbotDb;
}
