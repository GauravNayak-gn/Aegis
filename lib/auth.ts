import { NextAuthOptions } from "next-auth";
import GithubProvider from "next-auth/providers/github";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "../db";
import { users, accounts, sessions, verificationTokens } from "../db/schema";
import { eq, and } from "drizzle-orm";


declare module "next-auth" {
  interface Session {
    accessToken?: string;
    user?: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    id?: string;
  }
}

export const authOptions: NextAuthOptions = {
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: {
    strategy: "jwt",
  },
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "read:user user:email repo write:repo_hook",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, user }) {
      if (account) {
        token.accessToken = account.access_token;

        // Keep the database accounts table updated with the latest OAuth credentials
        try {
          await db
            .update(accounts)
            .set({
              access_token: account.access_token,
              refresh_token: account.refresh_token,
              expires_at: account.expires_at,
              scope: account.scope,
            })
            .where(
              and(
                eq(accounts.provider, account.provider),
                eq(accounts.providerAccountId, account.providerAccountId)
              )
            );
          console.log(
            "[NextAuth] Successfully updated database access token for providerAccountId:",
            account.providerAccountId
          );
        } catch (dbErr) {
          console.error(
            "[NextAuth] Failed to update access token in database:",
            dbErr
          );
        }
      }
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session && session.user) {
        session.accessToken = token.accessToken;
        session.user.id = token.id;
      }
      return session;
    },
  },
  logger: {
    error(code, metadata) {
      console.error(" [NEXTAUTH_RAW_ERROR] CODE:", code);
      console.error(" [NEXTAUTH_RAW_ERROR] METADATA:", metadata);
    },
  },
};
