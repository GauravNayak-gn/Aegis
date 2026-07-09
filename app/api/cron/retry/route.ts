import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../db";
import { events } from "../../../../db/schema";
import { eq, and, lt } from "drizzle-orm";
import { processEvent } from "../../../../lib/processor";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // 1. Guardrail Check
    const authHeader = request.headers.get("Authorization");
    const cronSecret = process.env.CRON_SECRET;
    
    // Look up secret token in search params or Authorization header
    const searchParams = request.nextUrl.searchParams;
    const tokenParam = searchParams.get("token");

    let isAuthorized = false;

    if (cronSecret) {
      if (tokenParam === cronSecret) {
        isAuthorized = true;
      } else if (authHeader) {
        const token = authHeader.replace("Bearer ", "").trim();
        if (token === cronSecret) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Fetch failed events where attempts < 5
    const failedEvents = await db
      .select()
      .from(events)
      .where(and(eq(events.status, "failed"), lt(events.attempts, 5)));

    const results = [];

    // 3. Process each event
    for (const event of failedEvents) {
      const nextAttempts = event.attempts + 1;
      
      // Update attempts first
      await db
        .update(events)
        .set({ attempts: nextAttempts, status: "processing" })
        .where(eq(events.id, event.id));

      try {
        console.log(`[Cron Retry] Retrying event ID ${event.id} (attempt #${nextAttempts})...`);
        await processEvent(event.id);
        
        // Fetch updated status
        const [updatedEvent] = await db
          .select({ status: events.status })
          .from(events)
          .where(eq(events.id, event.id))
          .limit(1);

        results.push({
          eventId: event.id,
          attempts: nextAttempts,
          status: updatedEvent?.status || "unknown",
        });
      } catch (err: any) {
        console.error(`[Cron Retry] Error processing event ID ${event.id}:`, err);
        
        await db
          .update(events)
          .set({ status: "failed", lastError: err.message || "Retry pipeline error" })
          .where(eq(events.id, event.id));

        results.push({
          eventId: event.id,
          attempts: nextAttempts,
          status: "failed",
          error: err.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    });
  } catch (err: any) {
    console.error("[Cron Retry Error]:", err);
    return NextResponse.json(
      { error: "Cron execution failed", details: err.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
