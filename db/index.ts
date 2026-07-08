import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  sql: any;
  db: NeonHttpDatabase<typeof schema> | undefined;
};

const sql = globalForDb.sql ?? neon(process.env.DATABASE_URL!);

if (process.env.NODE_ENV !== "production") {
  globalForDb.sql = sql;
}

export const db = (globalForDb.db ?? drizzle(sql, { schema })) as NeonHttpDatabase<typeof schema>;

if (process.env.NODE_ENV !== "production") {
  globalForDb.db = db;
}



