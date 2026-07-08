import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/auth";
import { db } from "../../../db";
import { events, actions, repositories } from "../../../db/schema";
import { eq, desc, inArray, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    if (!userId) {
      return NextResponse.json({ error: "User ID missing from session" }, { status: 400 });
    }

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

    if (recentEvents.length === 0) {
      return NextResponse.json([]);
    }

    // 2. Fetch associated actions for these events
    const eventIds = recentEvents.map((e) => e.id);
    const associatedActions = await db
      .select()
      .from(actions)
      .where(inArray(actions.eventId, eventIds))
      .orderBy(asc(actions.createdAt));

    // 3. Map actions to their respective events
    const eventsWithActions = recentEvents.map((event) => ({
      ...event,
      actions: associatedActions.filter((action) => action.eventId === event.id),
    }));

    return NextResponse.json(eventsWithActions);
  } catch (err: any) {
    console.error("[Events API Error]:", err);
    return NextResponse.json(
      { error: "Failed to fetch event logs", details: err.message },
      { status: 500 }
    );
  }
}
