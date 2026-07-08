import { getServerSession } from "next-auth/next";
import { authOptions } from "../../lib/auth";
import { listUserRepos } from "../actions/repo";
import DashboardClient from "./dashboard-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    // Passing no user shows the sign-in screen on the dashboard-client
    return <DashboardClient initialRepos={[]} initialError={null} />;
  }

  let repos: any[] = [];
  let error: string | null = null;

  try {
    repos = await listUserRepos();
  } catch (err: any) {
    error = err.message || "Failed to load repositories from GitHub.";
  }

  return (
    <DashboardClient
      initialRepos={repos}
      initialError={error}
      user={session.user}
    />
  );
}
