import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";
import ws from "ws";

// Force Neon to use WebSocket connection (port 443) instead of direct TCP (port 5432)
if (typeof window === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

const globalForDb = globalThis as unknown as {
  pool: Pool | undefined;
  db: NeonDatabase<typeof schema> | undefined;
};

const pool =
  globalForDb.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10, // Limit maximum connections to avoid exhaustion in serverless environments
    idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
    connectionTimeoutMillis: 2000, // Terminate connection attempts that hang for > 2 seconds
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
}

export const db =
  globalForDb.db ??
  (drizzle({ client: pool, schema }) as NeonDatabase<typeof schema>);

if (process.env.NODE_ENV !== "production") {
  globalForDb.db = db;
}





