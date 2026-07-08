"use server";

import { getServerSession } from "next-auth/next";
import { authOptions } from "../../lib/auth";
import { db } from "../../db";
import { repositories } from "../../db/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

export async function listUserRepos() {
  const session = await getServerSession(authOptions);
  if (!session || !session.accessToken || !session.user?.id) {
    throw new Error("Unauthorized");
  }

  // Fetch repositories from GitHub API
  const response = await fetch("https://api.github.com/user/repos?per_page=100", {
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "GitHub-Automation-Bot",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch repos from GitHub: ${response.statusText}`);
  }

  const githubRepos = await response.json();

  // Fetch currently connected repositories from our database
  const connectedRepos = await db
    .select()
    .from(repositories)
    .where(eq(repositories.userId, session.user.id));

  const connectedRepoMap = new Map(
    connectedRepos.map((r) => [r.fullName, r])
  );

  return githubRepos.map((repo: any) => ({
    githubRepoId: repo.id,
    fullName: repo.full_name,
    description: repo.description,
    isPrivate: repo.private,
    htmlUrl: repo.html_url,
    isConnected: connectedRepoMap.has(repo.full_name),
    webhookId: connectedRepoMap.get(repo.full_name)?.webhookId || null,
  }));
}

export async function connectRepo(repoFullName: string, githubRepoId?: number) {
  const session = await getServerSession(authOptions);
  if (!session || !session.accessToken || !session.user?.id) {
    throw new Error("Unauthorized");
  }

  let finalRepoId = githubRepoId;
  if (!finalRepoId) {
    // Fetch repository details to get the GitHub ID if not provided
    const repoRes = await fetch(`https://api.github.com/repos/${repoFullName}`, {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "GitHub-Automation-Bot",
      },
    });

    if (!repoRes.ok) {
      throw new Error(`Failed to fetch repository details: ${repoRes.statusText}`);
    }

    const repoData = await repoRes.json();
    finalRepoId = repoData.id;
  }

  if (!finalRepoId) {
    throw new Error("Could not determine GitHub Repository ID");
  }

  // Check if already connected in our DB
  const existing = await db
    .select()
    .from(repositories)
    .where(
      and(
        eq(repositories.userId, session.user.id),
        eq(repositories.githubRepoId, finalRepoId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    throw new Error("Repository is already connected");
  }

  // Generate a 32-byte hex webhook secret
  const webhookSecret = crypto.randomBytes(32).toString("hex");

  // Determine the webhook endpoint URL
  const appUrl = process.env.NEXTAUTH_URL || "https://your-app.vercel.app";
  const webhookUrl = `${appUrl}/api/webhooks/github`;

  // Create the webhook on GitHub repository
  const hookResponse = await fetch(`https://api.github.com/repos/${repoFullName}/hooks`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "GitHub-Automation-Bot",
    },
    body: JSON.stringify({
      name: "web",
      active: true,
      events: ["issues", "pull_request", "push"],
      config: {
        url: webhookUrl,
        content_type: "json",
        secret: webhookSecret,
      },
    }),
  });

  if (!hookResponse.ok) {
    const errData = await hookResponse.json().catch(() => ({}));
    throw new Error(
      `Failed to create GitHub webhook: ${errData.message || hookResponse.statusText}`
    );
  }

  const hookData = await hookResponse.json();
  const webhookId = hookData.id;

  // Save the repository to the database
  const [newRepo] = await db
    .insert(repositories)
    .values({
      userId: session.user.id,
      githubRepoId: finalRepoId,
      fullName: repoFullName,
      webhookSecret,
      webhookId,
    })
    .returning();

  return {
    success: true,
    repository: newRepo,
  };
}
