import {
  pgTable,
  text,
  timestamp,
  integer,
  primaryKey,
  boolean,
  jsonb,
  serial,
} from "drizzle-orm/pg-core";
import type { AdapterAccount } from "next-auth/adapters";

// --- NextAuth Required Tables ---

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccount["type"]>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  })
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  })
);

// --- Custom Tables for GitHub Automation ---

export const repositories = pgTable("repository", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  githubRepoId: integer("github_repo_id").notNull(),
  fullName: text("full_name").notNull(),
  webhookSecret: text("webhook_secret"),
  webhookId: integer("webhook_id"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const events = pgTable("event", {
  id: serial("id").primaryKey(),
  deliveryId: text("delivery_id").notNull().unique(),
  repositoryId: integer("repository_id")
    .notNull()
    .references(() => repositories.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  action: text("action"),
  payload: jsonb("payload").notNull(),
  status: text("status").notNull().default("pending"), // pending, processing, completed, failed
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const actions = pgTable("action", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // label, comment, slack, triage
  target: text("target"),
  detail: text("detail"),
  status: text("status").notNull().default("pending"), // pending, completed, failed
  error: text("error"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const rules = pgTable("rule", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  eventType: text("event_type").notNull(),
  actionFilter: text("action_filter"),
  matchField: text("match_field"),
  matchOp: text("match_op"),
  matchValue: text("match_value"),
  addLabel: text("add_label"),
  postComment: text("post_comment"),
  slackNotify: text("slack_notify"),
  aiTriage: boolean("ai_triage").default(false).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});
