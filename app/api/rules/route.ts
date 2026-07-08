import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/auth";
import { db } from "../../../db";
import { rules } from "../../../db/schema";
import { eq, desc } from "drizzle-orm";

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
