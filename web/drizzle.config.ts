import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

dotenv.config({ path: ".env.local" });
dotenv.config();

/**
 * Migrations need the session pooler (port 5432); DDL over the transaction
 * pooler is not something drizzle-kit can do. Deployed environments point
 * `DATABASE_URL` at 6543 for the reason spelled out in `.env.example`, so they
 * set `MIGRATIONS_DATABASE_URL` as well. Locally one 5432 URL serves both.
 */
const migrationUrl = process.env.MIGRATIONS_DATABASE_URL ?? process.env.DATABASE_URL ?? "";

export default defineConfig({
  out: "./drizzle",
  schema: "./server/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: migrationUrl,
  },
  verbose: true,
  strict: true,
});
