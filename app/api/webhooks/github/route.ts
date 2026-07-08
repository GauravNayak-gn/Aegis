import { NextRequest } from "next/server";
import { db } from "../../../../db";
import { events, repositories } from "../../../../db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { waitUntil } from "@vercel/functions";

// Stub for processing events in the background
async function processEvent(eventId: number) {
  console.log(`[Background] Started processing event ID: ${eventId}`);
  
  // Here we would perform logic based on the event:
  // 1. Fetch action rules matching this repository and event type
  // 2. Evaluate rules against webhook payload fields
  // 3. Execute actions (applying label, posting comment, Slack alert, AI triage)
  // 4. Update the event status to 'completed' or 'failed'
  
  try {
    // In a real application, this is where rule matching & executions happen.
    console.log(`[Background] Successfully processed event ID: ${eventId}`);
  } catch (err: any) {
    console.error(`[Background] Error processing event ID: ${eventId}`, err);
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Read the raw body as text for signature verification
    const rawBody = await request.text();

    // 2. Extract key headers
    const signatureHeader = request.headers.get("x-hub-signature-256");
    const deliveryId = request.headers.get("x-github-delivery");
    const eventType = request.headers.get("x-github-event");

    if (!signatureHeader || !deliveryId || !eventType) {
      return new Response("Missing required headers", { status: 400 });
    }

    // 3. Parse payload securely
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch (e) {
      return new Response("Invalid JSON payload", { status: 400 });
    }

    const repoFullName = payload.repository?.full_name;
    if (!repoFullName) {
      return new Response("Missing repository full name in payload", {
        status: 400,
      });
    }

    // 4. Lookup matching repository
    const [repo] = await db
      .select()
      .from(repositories)
      .where(eq(repositories.fullName, repoFullName))
      .limit(1);

    if (!repo) {
      return new Response("Repository not registered", { status: 404 });
    }

    if (!repo.webhookSecret) {
      return new Response("Webhook secret not configured on server", {
        status: 500,
      });
    }

    // 5. Verify signature authenticity in constant time
    const signature = signatureHeader.replace("sha256=", "");
    const hmac = crypto.createHmac("sha256", repo.webhookSecret);
    hmac.update(rawBody);
    const digest = hmac.digest("hex");

    const expectedBuffer = Buffer.from(digest, "utf8");
    const actualBuffer = Buffer.from(signature, "utf8");

    if (
      expectedBuffer.length !== actualBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, actualBuffer)
    ) {
      return new Response("Invalid signature", { status: 401 });
    }

    // 6. Enforce event idempotency using onConflictDoNothing
    const result = await db
      .insert(events)
      .values({
        deliveryId,
        repositoryId: repo.id,
        eventType,
        action: payload.action || null,
        payload,
        status: "pending",
        attempts: 0,
      })
      .onConflictDoNothing({ target: events.deliveryId })
      .returning();

    // If no row was inserted (meaning a duplicate delivery_id was found)
    if (result.length === 0) {
      console.log(`[Webhook] Duplicate delivery detected: ${deliveryId}. Stopping.`);
      return new Response("Duplicate delivery detected", { status: 200 });
    }

    const insertedEvent = result[0];

    // 7. For a fresh unique event, trigger background processing and return 200 OK
    waitUntil(processEvent(insertedEvent.id));

    return new Response("Webhook received and queued", { status: 200 });
  } catch (err: any) {
    console.error("[Webhook Error]:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}

export async function GET() {
  return new Response("OK", { status: 200 });
}
