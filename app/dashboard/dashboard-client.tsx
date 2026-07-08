"use client";

import React, { useState, useEffect } from "react";
import { signIn, signOut } from "next-auth/react";
import { connectRepo } from "../actions/repo";

export interface EventWithActions {
  id: number;
  deliveryId: string;
  repositoryId: number;
  eventType: string;
  action: string | null;
  status: string;
  attempts: number;
  lastError: string | null;
  createdAt: Date | string;
  repoFullName: string;
  actions: {
    id: number;
    eventId: number;
    kind: string;
    target: string | null;
    detail: string | null;
    status: string;
    error: string | null;
    createdAt: Date | string;
  }[];
}

interface Repo {
  githubRepoId: number;
  fullName: string;
  description: string | null;
  isPrivate: boolean;
  htmlUrl: string;
  isConnected: boolean;
  webhookId: number | null;
}

interface User {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

interface DashboardClientProps {
  initialRepos: Repo[];
  initialError: string | null;
  initialEvents: EventWithActions[];
  user?: User;
}

export default function DashboardClient({
  initialRepos,
  initialError,
  initialEvents,
  user,
}: DashboardClientProps) {
  const [repos, setRepos] = useState<Repo[]>(initialRepos);
  const [error, setError] = useState<string | null>(initialError);
  const [searchQuery, setSearchQuery] = useState("");
  const [connectingId, setConnectingId] = useState<number | null>(null);
  const [events, setEvents] = useState<EventWithActions[]>(initialEvents);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!user) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/events");
        if (!res.ok) return;
        const newEvents: EventWithActions[] = await res.json();

        setEvents((prev) => {
          const prevIds = new Set(prev.map((e) => e.id));
          const toAdd = newEvents.filter((e) => !prevIds.has(e.id));

          if (toAdd.length === 0) return prev;

          // Prepend new events to the top
          return [...toAdd, ...prev];
        });
      } catch (err) {
        console.error("Failed to poll events:", err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [user]);

  const formatTime = (dateVal: Date | string) => {
    if (!mounted) return "";
    const d = typeof dateVal === "string" ? new Date(dateVal) : dateVal;
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }) + " " + d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  };

  // If user is not authenticated, show a gorgeous login screen
  if (!user) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-zinc-950 font-sans text-zinc-50">
        {/* Decorative background glows */}
        <div className="absolute top-[-20%] left-[-20%] h-[60%] w-[60%] rounded-full bg-purple-900/20 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-20%] h-[60%] w-[60%] rounded-full bg-indigo-900/20 blur-[120px]" />

        <div className="relative z-10 w-full max-w-md px-6">
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-8 shadow-2xl backdrop-blur-xl">
            <div className="flex flex-col items-center text-center">
              {/* Animated Github Icon wrapper */}
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 shadow-lg shadow-purple-500/30">
                <svg
                  className="h-9 w-9 text-white"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.138 20.161 22 16.418 22 12c0-5.523-4.477-10-10-10z"
                  />
                </svg>
              </div>

              <h1 className="bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent">
                GitShield AI
              </h1>
              <p className="mt-3 text-sm text-zinc-400">
                Automate pull request triaging, apply rules, and receive Slack notifications.
              </p>

              <div className="my-6 h-px w-full bg-zinc-800" />

              <button
                onClick={() => signIn("github", { callbackUrl: "/dashboard" })}
                className="flex w-full items-center justify-center gap-3 rounded-xl bg-white px-5 py-3.5 text-base font-semibold text-zinc-950 transition-all hover:bg-zinc-200 active:scale-[0.98] shadow-lg shadow-white/5"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.138 20.161 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
                </svg>
                Sign in with GitHub
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Handle connecting a repository
  const handleConnect = async (repo: Repo) => {
    setConnectingId(repo.githubRepoId);
    setError(null);

    try {
      const result = await connectRepo(repo.fullName, repo.githubRepoId);
      if (result.success) {
        setRepos((prev) =>
          prev.map((r) =>
            r.githubRepoId === repo.githubRepoId
              ? { ...r, isConnected: true, webhookId: result.repository.webhookId }
              : r
          )
        );
      }
    } catch (err: any) {
      setError(err.message || "An error occurred while connecting the repository");
    } finally {
      setConnectingId(null);
    }
  };

  // Filter repos based on search query
  const filteredRepos = repos.filter((repo) =>
    repo.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-zinc-950 font-sans text-zinc-100">
      {/* Top Navigation Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 shadow-md shadow-purple-500/20">
              <svg className="h-6 w-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.138 20.161 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
              </svg>
            </div>
            <span className="text-xl font-bold tracking-tight text-white">GitShield AI</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-1.5 pr-4">
              {user.image ? (
                <img
                  src={user.image}
                  alt={user.name || "Avatar"}
                  className="h-8 w-8 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 text-sm font-semibold text-zinc-300">
                  {user.name?.charAt(0) || "U"}
                </div>
              )}
              <span className="text-sm font-medium text-zinc-300">{user.name}</span>
            </div>

            <button
              onClick={() => signOut({ callbackUrl: "/dashboard" })}
              className="rounded-xl border border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-white"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8">
          <h2 className="text-3xl font-extrabold tracking-tight text-white">Your Repositories</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Select a GitHub repository to connect. GitShield will set up webhooks automatically.
          </p>
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm text-rose-400">
            <svg
              className="h-5 w-5 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Filters and Controls */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-zinc-500">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Filter repositories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900/40 py-3 pl-11 pr-4 text-sm text-zinc-100 placeholder-zinc-500 transition-all focus:border-purple-500/50 focus:bg-zinc-900/80 focus:ring-1 focus:ring-purple-500/50 focus:outline-none"
            />
          </div>
        </div>

        {/* Repositories Grid */}
        {filteredRepos.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 p-12 text-center bg-zinc-900/10">
            <svg
              className="h-12 w-12 text-zinc-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
            <h3 className="mt-4 text-lg font-semibold text-zinc-300">No repositories found</h3>
            <p className="mt-1 text-sm text-zinc-500 max-w-xs">
              Make sure you have authorized GitShield to access your repositories or try a different filter.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredRepos.map((repo) => (
              <div
                key={repo.githubRepoId}
                className="group relative flex flex-col justify-between rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 transition-all duration-300 hover:border-zinc-700/80 hover:bg-zinc-900/50 hover:shadow-xl hover:shadow-purple-950/10"
              >
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-base font-semibold text-white group-hover:text-purple-400 transition-colors">
                      {repo.fullName.split("/")[1]}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium border ${
                        repo.isPrivate
                          ? "bg-zinc-800/40 border-zinc-700 text-zinc-400"
                          : "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
                      }`}
                    >
                      {repo.isPrivate ? "Private" : "Public"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500 truncate">{repo.fullName.split("/")[0]}</p>
                  <p className="mt-3 line-clamp-2 text-sm text-zinc-400 min-h-[40px]">
                    {repo.description || "No description provided."}
                  </p>
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-zinc-800/60 pt-4">
                  <a
                    href={repo.htmlUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-300"
                  >
                    View on GitHub
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  </a>

                  {repo.isConnected ? (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20 shadow-sm shadow-emerald-500/5">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2.5"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      Connected
                    </span>
                  ) : (
                    <button
                      onClick={() => handleConnect(repo)}
                      disabled={connectingId !== null}
                      className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md hover:shadow-purple-500/20 active:scale-[0.97]"
                    >
                      {connectingId === repo.githubRepoId ? (
                        <>
                          <svg
                            className="h-3.5 w-3.5 animate-spin text-white"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                          Connecting...
                        </>
                      ) : (
                        "Connect"
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Real-Time Event Log Section */}
        <div className="mt-16">
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500"></span>
                </span>
                Real-Time Event Log
              </h2>
              <p className="mt-1 text-sm text-zinc-400">
                Live activity feed of GitHub webhook events and automation actions.
              </p>
            </div>
            <div className="text-xs text-zinc-500 bg-zinc-900/60 border border-zinc-800/80 rounded-lg px-3 py-1.5 backdrop-blur-md self-start sm:self-auto">
              Polling every 5s
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/20 backdrop-blur-md shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm text-zinc-300">
                <thead className="border-b border-zinc-800/80 bg-zinc-900/50 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  <tr>
                    <th scope="col" className="px-6 py-4">Time</th>
                    <th scope="col" className="px-6 py-4">Repository</th>
                    <th scope="col" className="px-6 py-4">Event Type</th>
                    <th scope="col" className="px-6 py-4">Action Taken</th>
                    <th scope="col" className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50 bg-transparent">
                  {events.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-zinc-500 italic">
                        No webhook events recorded yet. Connect a repository and trigger an issue or pull request.
                      </td>
                    </tr>
                  ) : (
                    events.map((evt) => (
                      <tr key={evt.id} className="group hover:bg-zinc-900/20 transition-colors">
                        <td className="whitespace-nowrap px-6 py-4 text-xs font-mono text-zinc-400">
                          {formatTime(evt.createdAt)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 font-medium text-zinc-200">
                          {evt.repoFullName}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-xs">
                          <span className="rounded-md bg-zinc-800/60 px-2.5 py-1 font-mono text-zinc-300 border border-zinc-700/50">
                            {evt.eventType}{evt.action ? `.${evt.action}` : ""}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {evt.actions && evt.actions.length > 0 ? (
                            <div className="flex flex-col gap-1.5">
                              {evt.actions.map((act) => (
                                <div key={act.id} className="flex items-center gap-1.5 text-xs text-zinc-300">
                                  <span className={`h-1.5 w-1.5 rounded-full ${
                                    act.status === "completed" ? "bg-emerald-400" :
                                    act.status === "failed" ? "bg-rose-400" : "bg-amber-400"
                                  }`} />
                                  <span>
                                    {act.kind === "slack" ? "Sent Slack notification" :
                                     act.kind === "label" ? `Added '${act.target}' label` :
                                     act.kind === "comment" ? "Posted welcome comment" :
                                     act.detail || act.kind}
                                  </span>
                                  {act.error && (
                                    <span className="text-[10px] text-rose-400 font-mono">
                                      ({act.error})
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : evt.lastError ? (
                            <span className="text-xs text-rose-400 font-mono italic">
                              Error: {evt.lastError}
                            </span>
                          ) : (
                            <span className="text-xs text-zinc-500 italic">No actions triggered</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                            evt.status === "completed" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-sm shadow-emerald-500/5" :
                            evt.status === "failed" ? "bg-rose-500/10 border-rose-500/20 text-rose-400 shadow-sm shadow-rose-500/5" :
                            "bg-amber-500/10 border-amber-500/20 text-amber-400 animate-pulse shadow-sm shadow-amber-500/5"
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${
                              evt.status === "completed" ? "bg-emerald-400" :
                              evt.status === "failed" ? "bg-rose-400" : "bg-amber-400"
                            }`} />
                            {evt.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
