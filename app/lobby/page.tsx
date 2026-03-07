"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type Match = {
  id: string;
  game: "RPS" | "TTT" | "C4" | "CHESS" | "CHECKERS";
  series: "QUICK" | "BO3" | "BO5";
  stakeMode: "CREDITS" | "SOL";
  stakeAmount: number;
  status: "WAITING" | "ACTIVE" | "COMPLETED" | "CANCELLED";
};

type Agent = {
  id: string;
  name: string;
  house: "RED" | "GREEN" | "BLUE" | "YELLOW";
};

export default function LobbyPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [stakeAmount, setStakeAmount] = useState(100);
  const [series, setSeries] = useState<"QUICK" | "BO3" | "BO5">("QUICK");
  const [creatorAgentId, setCreatorAgentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    setError(null);
    try {
      const [matchesRes, agentsRes] = await Promise.all([
        fetch("/api/matches", { cache: "no-store" }),
        fetch("/api/agents", { cache: "no-store" }),
      ]);
      const matchesData = (await matchesRes.json()) as { matches?: Match[]; error?: string };
      const agentsData = (await agentsRes.json()) as { agents?: Agent[]; error?: string };

      if (!matchesRes.ok) throw new Error(matchesData.error ?? "Failed to load matches");
      if (!agentsRes.ok) throw new Error(agentsData.error ?? "Failed to load agents");

      const loadedAgents = agentsData.agents ?? [];
      setMatches(matchesData.matches ?? []);
      setAgents(loadedAgents);

      if (!creatorAgentId && loadedAgents.length > 0) {
        setCreatorAgentId(loadedAgents[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load lobby");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onCreateMatch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          game: "RPS",
          stakeMode: "CREDITS",
          stakeAmount: Number(stakeAmount),
          series,
          creatorAgentId,
        }),
      });

      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to create match");

      setShowCreateForm(false);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create match");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#05070C] px-6 py-10 text-zinc-100">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs tracking-[0.3em] text-zinc-400">INTERHOUSE LOBBY</p>
            <h1 className="text-3xl font-semibold">Matches</h1>
          </div>
          <button
            className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900"
            onClick={() => setShowCreateForm((prev) => !prev)}
          >
            Create Match
          </button>
        </header>

        {showCreateForm ? (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
            <form className="grid gap-4 md:grid-cols-4" onSubmit={onCreateMatch}>
              <label className="grid gap-2 text-sm">
                Game
                <input
                  disabled
                  value="RPS"
                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-400"
                />
              </label>

              <label className="grid gap-2 text-sm">
                Stake Mode
                <input
                  disabled
                  value="CREDITS"
                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-400"
                />
              </label>

              <label className="grid gap-2 text-sm">
                Stake Amount
                <input
                  type="number"
                  min={0}
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(Number(e.target.value))}
                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none focus:border-zinc-500"
                />
              </label>

              <label className="grid gap-2 text-sm">
                Series
                <select
                  value={series}
                  onChange={(e) => setSeries(e.target.value as "QUICK" | "BO3" | "BO5")}
                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none focus:border-zinc-500"
                >
                  <option value="QUICK">QUICK</option>
                  <option value="BO3">BO3</option>
                  <option value="BO5">BO5</option>
                </select>
              </label>

              <label className="grid gap-2 text-sm md:col-span-4">
                Creator Agent
                <select
                  required
                  value={creatorAgentId}
                  onChange={(e) => setCreatorAgentId(e.target.value)}
                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none focus:border-zinc-500"
                >
                  {agents.length === 0 ? <option value="">No agents available</option> : null}
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name} ({agent.house})
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="submit"
                disabled={isSubmitting || !creatorAgentId}
                className="md:col-span-4 rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 disabled:opacity-40"
              >
                {isSubmitting ? "Creating..." : "Create"}
              </button>
            </form>
          </section>
        ) : null}

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
          <h2 className="text-xl font-semibold">Open Matches</h2>
          {isLoading ? <p className="mt-4 text-sm text-zinc-400">Loading matches...</p> : null}
          {!isLoading && matches.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-400">No matches yet.</p>
          ) : null}

          <div className="mt-4 grid gap-3">
            {matches.map((match) => (
              <Link
                key={match.id}
                href={`/match/${match.id}`}
                className="grid gap-2 rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 hover:border-zinc-700"
              >
                <p className="text-sm text-zinc-300">Match {match.id}</p>
                <p className="text-sm text-zinc-300">
                  {match.game} | {match.series} | {match.stakeMode} {match.stakeAmount}
                </p>
                <p className="text-sm font-medium">Status: {match.status}</p>
              </Link>
            ))}
          </div>
          {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
        </section>
      </div>
    </main>
  );
}
