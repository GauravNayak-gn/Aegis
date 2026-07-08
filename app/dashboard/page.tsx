import { getServerSession } from "next-auth/next";
import { authOptions } from "../../lib/auth";
import { listUserRepos } from "../actions/repo";
import DashboardClient from "./dashboard-client";
import { db } from "../../db";
import { events, actions, repositories } from "../../db/schema";
import { eq, desc, inArray, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    // Passing no user shows the sign-in screen on the dashboard-client
    return (
      <DashboardClient
        initialRepos={[]}
        initialError={null}
        initialEvents={[]}
      />
    );
  }

  let repos: any[] = [];
  let error: string | null = null;
  let initialEvents: any[] = [];

  try {
    repos = await listUserRepos();
  } catch (err: any) {
    error = err.message || "Failed to load repositories from GitHub.";
  }

  const userId = (session.user as any).id;
  if (userId) {
    try {
      // 1. Fetch 50 most recent events for the user's connected repositories
      const recentEvents = await db
        .select({
          id: events.id,
          deliveryId: events.deliveryId,
          repositoryId: events.repositoryId,
          eventType: events.eventType,
          action: events.action,
          status: events.status,
          attempts: events.attempts,
          lastError: events.lastError,
          createdAt: events.createdAt,
          repoFullName: repositories.fullName,
        })
        .from(events)
        .innerJoin(repositories, eq(events.repositoryId, repositories.id))
        .where(eq(repositories.userId, userId))
        .orderBy(desc(events.id))
        .limit(50);

      if (recentEvents.length > 0) {
        // 2. Fetch associated actions
        const eventIds = recentEvents.map((e) => e.id);
        const associatedActions = await db
          .select()
          .from(actions)
          .where(inArray(actions.eventId, eventIds))
          .orderBy(asc(actions.createdAt));

        // 3. Map actions to events
        initialEvents = recentEvents.map((event) => ({
          ...event,
          actions: associatedActions.filter(
            (action) => action.eventId === event.id
          ),
        }));
      }
    } catch (dbErr) {
      console.error("Failed to load initial event logs on server:", dbErr);
    }
  }

  return (
    <DashboardClient
      initialRepos={repos}
      initialError={error}
      initialEvents={initialEvents}
      user={session.user}
    />
  );
}
