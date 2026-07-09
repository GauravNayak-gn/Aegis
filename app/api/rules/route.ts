import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/auth";
import { db } from "../../../db";
import { rules } from "../../../db/schema";
import { eq, desc, and } from "drizzle-orm";

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

    const userRules = await db
      .select()
      .from(rules)
      .where(eq(rules.userId, userId))
      .orderBy(desc(rules.createdAt));

    return NextResponse.json(userRules);
  } catch (err: any) {
    console.error("[GET Rules API Error]:", err);
    return NextResponse.json(
      { error: "Failed to fetch rules", details: err.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    if (!userId) {
      return NextResponse.json({ error: "User ID missing from session" }, { status: 400 });
    }

    const body = await request.json();
    const {
      name,
      matchField,
      matchOp,
      matchValue,
      addLabel,
      postComment,
      slackNotify,
      slackWebhookUrl,
      aiTriage,
    } = body;

    // Validation
    if (!matchField || !matchOp || !matchValue) {
      return NextResponse.json(
        { error: "matchField, matchOp, and matchValue are required fields" },
        { status: 400 }
      );
    }

    const validFields = ["title", "body", "author"];
    const validOps = ["contains", "equals", "regex"];

    if (!validFields.includes(matchField)) {
      return NextResponse.json(
        { error: `matchField must be one of: ${validFields.join(", ")}` },
        { status: 400 }
      );
    }

    if (!validOps.includes(matchOp)) {
      return NextResponse.json(
        { error: `matchOp must be one of: ${validOps.join(", ")}` },
        { status: 400 }
      );
    }

    // Insert the new rule
    const [insertedRule] = await db
      .insert(rules)
      .values({
        userId,
        name: name || `Rule on ${matchField} ${matchOp} ${matchValue}`,
        eventType: "issues",
        matchField,
        matchOp,
        matchValue,
        addLabel: addLabel || null,
        postComment: postComment || null,
        slackNotify: !!slackNotify,
        slackWebhookUrl: slackWebhookUrl || null,
        aiTriage: !!aiTriage,
        active: true,
      })
      .returning();

    return NextResponse.json(insertedRule);
  } catch (err: any) {
    console.error("[POST Rules API Error]:", err);
    return NextResponse.json(
      { error: "Failed to create rule", details: err.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    if (!userId) {
      return NextResponse.json({ error: "User ID missing from session" }, { status: 400 });
    }

    const searchParams = request.nextUrl.searchParams;
    const idStr = searchParams.get("id");
    if (!idStr) {
      return NextResponse.json({ error: "Missing rule ID" }, { status: 400 });
    }

    const ruleId = parseInt(idStr, 10);
    if (isNaN(ruleId)) {
      return NextResponse.json({ error: "Invalid rule ID" }, { status: 400 });
    }

    const result = await db
      .delete(rules)
      .where(and(eq(rules.id, ruleId), eq(rules.userId, userId)))
      .returning();

    if (result.length === 0) {
      return NextResponse.json({ error: "Rule not found or unauthorized" }, { status: 404 });
    }

    return NextResponse.json({ success: true, deleted: result[0] });
  } catch (err: any) {
    console.error("[DELETE Rule API Error]:", err);
    return NextResponse.json(
      { error: "Failed to delete rule", details: err.message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    if (!userId) {
      return NextResponse.json({ error: "User ID missing from session" }, { status: 400 });
    }

    const searchParams = request.nextUrl.searchParams;
    const idStr = searchParams.get("id");
    if (!idStr) {
      return NextResponse.json({ error: "Missing rule ID" }, { status: 400 });
    }

    const ruleId = parseInt(idStr, 10);
    if (isNaN(ruleId)) {
      return NextResponse.json({ error: "Invalid rule ID" }, { status: 400 });
    }

    const body = await request.json();
    const {
      name,
      matchField,
      matchOp,
      matchValue,
      addLabel,
      postComment,
      slackNotify,
      slackWebhookUrl,
      aiTriage,
    } = body;

    // Validation
    if (!matchField || !matchOp || !matchValue) {
      return NextResponse.json(
        { error: "matchField, matchOp, and matchValue are required fields" },
        { status: 400 }
      );
    }

    const validFields = ["title", "body", "author"];
    const validOps = ["contains", "equals", "regex"];

    if (!validFields.includes(matchField)) {
      return NextResponse.json(
        { error: `matchField must be one of: ${validFields.join(", ")}` },
        { status: 400 }
      );
    }

    if (!validOps.includes(matchOp)) {
      return NextResponse.json(
        { error: `matchOp must be one of: ${validOps.join(", ")}` },
        { status: 400 }
      );
    }

    const [updatedRule] = await db
      .update(rules)
      .set({
        name: name || `Rule on ${matchField} ${matchOp} ${matchValue}`,
        matchField,
        matchOp,
        matchValue,
        addLabel: addLabel || null,
        postComment: postComment || null,
        slackNotify: !!slackNotify,
        slackWebhookUrl: slackWebhookUrl || null,
        aiTriage: !!aiTriage,
      })
      .where(and(eq(rules.id, ruleId), eq(rules.userId, userId)))
      .returning();

    if (!updatedRule) {
      return NextResponse.json({ error: "Rule not found or unauthorized" }, { status: 404 });
    }

    return NextResponse.json(updatedRule);
  } catch (err: any) {
    console.error("[PATCH Rule API Error]:", err);
    return NextResponse.json(
      { error: "Failed to update rule", details: err.message },
      { status: 500 }
    );
  }
}
