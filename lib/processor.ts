import { db } from "../db";
import { events, repositories, accounts, actions } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { addLabel, postComment } from "./github/client";

export async function processEvent(eventId: number) {
  console.log(`[Processor] Started processing event ID: ${eventId}`);

  try {
    // 1. Fetch the event details from the database
    const [event] = await db
      .select()
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);

    if (!event) {
      console.error(`[Processor] Event not found: ${eventId}`);
      return;
    }

    // Update event status to processing
    await db
      .update(events)
      .set({ status: "processing", attempts: event.attempts + 1 })
      .where(eq(events.id, eventId));

    // 2. Fetch the associated repository data
    const [repo] = await db
      .select()
      .from(repositories)
      .where(eq(repositories.id, event.repositoryId))
      .limit(1);

    if (!repo) {
      const errorMsg = `Repository not found for repository ID: ${event.repositoryId}`;
      console.error(`[Processor] ${errorMsg}`);
      await db
        .update(events)
        .set({ status: "failed", lastError: errorMsg })
        .where(eq(events.id, eventId));
      return;
    }

    // Look up the owner's GitHub accessToken from the NextAuth account table
    const [account] = await db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.userId, repo.userId),
          eq(accounts.provider, "github")
        )
      )
      .limit(1);

    if (!account || !account.access_token) {
      const errorMsg = `GitHub access token not found for user ID: ${repo.userId}`;
      console.error(`[Processor] ${errorMsg}`);
      await db
        .update(events)
        .set({ status: "failed", lastError: errorMsg })
        .where(eq(events.id, eventId));
      return;
    }

    const payload = event.payload as any;
    const token = account.access_token;
    const repoFullName = repo.fullName;

    // 3. Implement hardcoded rule:
    // If the event_type is 'issues' and the payload action is 'opened'
    if (event.eventType === "issues" && payload?.action === "opened") {
      const issueNumber = payload?.issue?.number;
      if (!issueNumber) {
        const errorMsg = "Issue number not found in payload";
        console.error(`[Processor] ${errorMsg}`);
        await db
          .update(events)
          .set({ status: "failed", lastError: errorMsg })
          .where(eq(events.id, eventId));
        return;
      }

      let labelFailed = false;
      let commentFailed = false;
      let labelErrorMsg = "";
      let commentErrorMsg = "";

      // Call addLabel to add 'needs-triage' label
      try {
        console.log(`[Processor] Adding 'needs-triage' label to issue #${issueNumber}`);
        await addLabel(repoFullName, issueNumber, "needs-triage", token);

        await db.insert(actions).values({
          eventId: event.id,
          kind: "label",
          target: `issue #${issueNumber}`,
          detail: "Added 'needs-triage' label",
          status: "success",
        });
      } catch (err: any) {
        labelFailed = true;
        labelErrorMsg = err.message || "Unknown error";
        console.error(`[Processor] Failed to add label:`, err);

        await db.insert(actions).values({
          eventId: event.id,
          kind: "label",
          target: `issue #${issueNumber}`,
          detail: "Failed to add 'needs-triage' label",
          status: "failed",
          error: labelErrorMsg,
        });
      }

      // Call postComment to post a welcome message
      try {
        const welcomeMessage =
          "Thank you for opening this issue! Our automation bot has received it.";
        console.log(`[Processor] Posting welcome comment to issue #${issueNumber}`);
        await postComment(repoFullName, issueNumber, welcomeMessage, token);

        await db.insert(actions).values({
          eventId: event.id,
          kind: "comment",
          target: `issue #${issueNumber}`,
          detail: "Posted welcome comment",
          status: "success",
        });
      } catch (err: any) {
        commentFailed = true;
        commentErrorMsg = err.message || "Unknown error";
        console.error(`[Processor] Failed to post comment:`, err);

        await db.insert(actions).values({
          eventId: event.id,
          kind: "comment",
          target: `issue #${issueNumber}`,
          detail: "Failed to post welcome comment",
          status: "failed",
          error: commentErrorMsg,
        });
      }

      // Update final event status
      if (labelFailed || commentFailed) {
        const combinedError = [
          labelFailed ? `Label: ${labelErrorMsg}` : null,
          commentFailed ? `Comment: ${commentErrorMsg}` : null,
        ]
          .filter(Boolean)
          .join(" | ");

        await db
          .update(events)
          .set({ status: "failed", lastError: combinedError })
          .where(eq(events.id, eventId));
      } else {
        await db
          .update(events)
          .set({ status: "completed", lastError: null })
          .where(eq(events.id, eventId));
      }
    } else {
      // Event received but did not trigger the hardcoded issues/opened rule
      console.log(
        `[Processor] Event ID ${eventId} (${event.eventType}.${payload?.action || "none"}) skipped (no matching rule)`
      );
      await db
        .update(events)
        .set({ status: "completed" })
        .where(eq(events.id, eventId));
    }
  } catch (err: any) {
    console.error(`[Processor] Exception during event ID ${eventId} processing:`, err);
    try {
      await db
        .update(events)
        .set({ status: "failed", lastError: err.message || "Unhandled exception" })
        .where(eq(events.id, eventId));
    } catch (dbErr) {
      console.error(`[Processor] Could not update event status after exception:`, dbErr);
    }
  }
}
