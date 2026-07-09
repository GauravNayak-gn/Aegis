import { db } from "../db";
import { events, repositories, accounts, actions, rules } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { addLabel, postComment } from "./github/client";
import { sendSlackNotification } from "./slack/client";
import OpenAI from "openai";

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

    // 3. Dynamic Rules Engine evaluation:
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

      // Fetch active rules belonging to the repository owner
      const userRules = await db
        .select()
        .from(rules)
        .where(and(eq(rules.userId, repo.userId), eq(rules.active, true)));

      let matchedRuleCount = 0;
      let totalFailedActions = 0;
      const actionErrors: string[] = [];

      for (const rule of userRules) {
        // Pull target metadata based on matchField
        let valueToCheck = "";
        if (rule.matchField === "title") {
          valueToCheck = payload?.issue?.title || "";
        } else if (rule.matchField === "body") {
          valueToCheck = payload?.issue?.body || "";
        } else if (rule.matchField === "author") {
          valueToCheck =
            payload?.issue?.user?.login || payload?.sender?.login || "";
        } else {
          continue; // Unknown field
        }

        const matchValue = rule.matchValue || "";
        let isMatch = false;

        if (rule.matchOp === "equals") {
          isMatch = valueToCheck.toLowerCase() === matchValue.toLowerCase();
        } else if (rule.matchOp === "contains") {
          isMatch = valueToCheck
            .toLowerCase()
            .includes(matchValue.toLowerCase());
        } else if (rule.matchOp === "regex") {
          try {
            const regex = new RegExp(matchValue, "i");
            isMatch = regex.test(valueToCheck);
          } catch (regErr: any) {
            console.error(
              `[Processor] Invalid regex "${matchValue}" in rule ID ${rule.id}:`,
              regErr
            );
            isMatch = false;
          }
        }

        if (isMatch) {
          matchedRuleCount++;
          console.log(
            `[Processor] Rule "${rule.name}" (ID ${rule.id}) matched for issue #${issueNumber}`
          );

          let aiTriageRan = false;
          let aiInsight: { summary: string; priority: string } | null = null;

          // AI Triage Action
          if (rule.aiTriage) {
            try {
              console.log(`[Processor] Running DeepSeek AI Triage for rule ${rule.id}`);
              const openai = new OpenAI({
                apiKey: process.env.OPENCODE_API_KEY,
                baseURL: process.env.OPENCODE_BASE_URL || "https://api.opencode.ai",
              });

              const issueTitle = payload?.issue?.title || "No Title";
              const issueBody = payload?.issue?.body || "No Description";

              const response = await openai.chat.completions.create({
                model: "deepseek-v4-flash",
                messages: [
                  {
                    role: "system",
                    content: `You are an AI assistant analyzing GitHub issues. Analyze the issue title and description body provided.
You must respond with a raw JSON object containing exactly these two fields:
1. "summary": A concise, single-paragraph summary of the issue.
2. "priority": An urgency rating ('Low', 'Medium', 'High') followed by a colon and a 1-sentence justification string (e.g. "High: The login endpoint is throwing 500 errors preventing user access").
Do not include markdown tags like \`\`\`json or backticks. Respond only with raw JSON.`,
                  },
                  {
                    role: "user",
                    content: `Title: ${issueTitle}\n\nBody: ${issueBody}`,
                  },
                ],
                response_format: { type: "json_object" },
              });

              console.log("[Processor] OpenCode Raw Response Structure:", JSON.stringify(response, null, 2));

              if (!response || typeof response !== "object" || !("choices" in response)) {
                console.error("[Processor] OpenCode API returned a 404 endpoint mismatch");
                await db.insert(actions).values({
                  eventId: event.id,
                  kind: "triage",
                  target: `issue #${issueNumber}`,
                  detail: `OpenCode API returned a 404 endpoint mismatch: ${String(response)}`,
                  status: "failed",
                  error: "Invalid API response structure or 404 Not Found",
                });
              } else {
                const jsonContent = response?.choices?.[0]?.message?.content || "{}";
                console.log("[Processor] DeepSeek raw response:", jsonContent);
                
                try {
                  const parsed = JSON.parse(jsonContent);
                  if (parsed.summary && parsed.priority) {
                    aiInsight = {
                      summary: parsed.summary,
                      priority: parsed.priority,
                    };
                    aiTriageRan = true;

                    const detailText = `[AI Triage - Priority: ${parsed.priority}] ${parsed.summary}`;
                    await db.insert(actions).values({
                      eventId: event.id,
                      kind: "triage",
                      target: `issue #${issueNumber}`,
                      detail: detailText,
                      status: "completed",
                    });
                  } else {
                    console.error("[Processor] Invalid JSON structure in DeepSeek response:", jsonContent);
                    await db.insert(actions).values({
                      eventId: event.id,
                      kind: "triage",
                      target: `issue #${issueNumber}`,
                      detail: `Invalid JSON structure: ${jsonContent}`,
                      status: "failed",
                      error: "Missing summary or priority fields",
                    });
                  }
                } catch (parseErr: any) {
                  console.error("[Processor] JSON parse error on DeepSeek response:", parseErr);
                  await db.insert(actions).values({
                    eventId: event.id,
                    kind: "triage",
                    target: `issue #${issueNumber}`,
                    detail: `Failed to parse JSON response: ${jsonContent}`,
                    status: "failed",
                    error: parseErr.message || "JSON Parse Error",
                  });
                }
              }
            } catch (err: any) {
              console.error(`[Processor] Failed DeepSeek AI Triage (tolerated error) for rule ${rule.id}:`, err);
              try {
                await db.insert(actions).values({
                  eventId: event.id,
                  kind: "triage",
                  target: `issue #${issueNumber}`,
                  detail: `AI triage failed: ${err.message || "Unknown error"}`,
                  status: "failed",
                  error: err.message || "AI triage error",
                });
              } catch (dbErr) {
                console.error("[Processor] Failed to log failed triage action:", dbErr);
              }
            }
          }

          // Execute other actions sequentially
          // 1. Add Label
          if (rule.addLabel) {
            try {
              console.log(
                `[Processor] Adding label '${rule.addLabel}' to issue #${issueNumber}`
              );
              await addLabel(repoFullName, issueNumber, rule.addLabel, token);

              await db.insert(actions).values({
                eventId: event.id,
                kind: "label",
                target: rule.addLabel,
                detail: `Added '${rule.addLabel}' label via rule: ${rule.name}`,
                status: "completed",
              });
            } catch (err: any) {
              totalFailedActions++;
              const errorMsg = err.message || "Unknown error";
              actionErrors.push(`Label (${rule.addLabel}): ${errorMsg}`);
              console.error(
                `[Processor] Failed to add label via rule ${rule.id}:`,
                err
              );

              await db.insert(actions).values({
                eventId: event.id,
                kind: "label",
                target: rule.addLabel,
                detail: `Failed to add '${rule.addLabel}' label via rule: ${rule.name}`,
                status: "failed",
                error: errorMsg,
              });
            }
          }

          // 2. Post Comment
          if (rule.postComment) {
            try {
              console.log(
                `[Processor] Posting welcome comment to issue #${issueNumber}`
              );
              await postComment(
                repoFullName,
                issueNumber,
                rule.postComment,
                token
              );

              await db.insert(actions).values({
                eventId: event.id,
                kind: "comment",
                target: `issue #${issueNumber}`,
                detail: `Posted comment via rule: ${rule.name}`,
                status: "completed",
              });
            } catch (err: any) {
              totalFailedActions++;
              const errorMsg = err.message || "Unknown error";
              actionErrors.push(`Comment: ${errorMsg}`);
              console.error(
                `[Processor] Failed to post comment via rule ${rule.id}:`,
                err
              );

              await db.insert(actions).values({
                eventId: event.id,
                kind: "comment",
                target: `issue #${issueNumber}`,
                detail: `Failed to post comment via rule: ${rule.name}`,
                status: "failed",
                error: errorMsg,
              });
            }
          }

          // 3. Slack notification
          if (rule.slackNotify) {
            const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
            if (slackWebhookUrl) {
              try {
                const opener =
                  payload?.issue?.user?.login ||
                  payload?.sender?.login ||
                  "unknown";
                const issueTitle = payload?.issue?.title || "No Title";
                
                let slackMessage = `Rule Match: *${rule.name}* triggered for issue #${issueNumber} in *${repoFullName}*\n*Title:* ${issueTitle}\n*Opened by:* ${opener}`;

                if (aiTriageRan && aiInsight) {
                  slackMessage += `\n\n*AI Triage Analysis:*\n*Priority:* ${aiInsight.priority}\n*Summary:* ${aiInsight.summary}`;
                }

                console.log(
                  `[Processor] Sending Slack notification for rule ${rule.id}`
                );
                await sendSlackNotification(slackWebhookUrl, slackMessage);

                await db.insert(actions).values({
                  eventId: event.id,
                  kind: "slack",
                  target: `Slack Channel`,
                  detail: `Sent Slack notification via rule: ${rule.name}`,
                  status: "completed",
                });
              } catch (err: any) {
                totalFailedActions++;
                const errorMsg = err.message || "Unknown error";
                actionErrors.push(`Slack: ${errorMsg}`);
                console.error(
                  `[Processor] Failed to send Slack alert via rule ${rule.id}:`,
                  err
                );

                await db.insert(actions).values({
                  eventId: event.id,
                  kind: "slack",
                  target: `Slack Channel`,
                  detail: `Failed to send Slack notification via rule: ${rule.name}`,
                  status: "failed",
                  error: errorMsg,
                });
              }
            } else {
              console.warn(
                `[Processor] Slack notification skipped: SLACK_WEBHOOK_URL is not set`
              );
            }
          }
        }
      }

      console.log(
        `[Processor] Processed ${userRules.length} rules. ${matchedRuleCount} matched, ${totalFailedActions} actions failed.`
      );

      // Update final event status
      if (totalFailedActions > 0) {
        await db
          .update(events)
          .set({ status: "failed", lastError: actionErrors.join(" | ") })
          .where(eq(events.id, eventId));
      } else {
        await db
          .update(events)
          .set({ status: "completed", lastError: null })
          .where(eq(events.id, eventId));
      }
    } else {
      // Event received but did not trigger rule pipeline
      console.log(
        `[Processor] Event ID ${eventId} (${event.eventType}.${
          payload?.action || "none"
        }) skipped (no matching trigger)`
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
