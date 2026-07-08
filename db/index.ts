import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  conn: Pool | undefined;
  db: NodePgDatabase<typeof schema> | undefined;
};

// Caching the Pool instance to prevent connection leaks
const conn =
  globalForDb.conn ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10, // Limit maximum connections to avoid exhaustion in serverless environments
    idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
    connectionTimeoutMillis: 2000, // Terminate connection attempts that hang for > 2 seconds
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.conn = conn;
}

// Caching the Drizzle DB instance
export const db = globalForDb.db ?? drizzle(conn, { schema });

if (process.env.NODE_ENV !== "production") {
  globalForDb.db = db;
}

