"use client";

import { FormEvent, useEffect, useState } from "react";
import { AgentDetailModal } from "@/components/AgentDetailModal";

type House = "RED" | "GREEN" | "BLUE" | "YELLOW";
type StrategyProfile = "AGGRESSIVE" | "DEFENSIVE" | "CHAOTIC" | "CALCULATED" | "ADAPTIVE";

type Agent = {
  id: string;
  name: string;
  house: House;
  strategyProfile: StrategyProfile;
  tier: "ROOKIE" | "CONTENDER" | "CHAMPION" | "ELITE";
  wins: number;
  losses: number;
  credits: number;
};

const HOUSES: House[] = ["RED", "GREEN", "BLUE", "YELLOW"];
const STRATEGIES: StrategyProfile[] = ["AGGRESSIVE", "DEFENSIVE", "CHAOTIC", "CALCULATED", "ADAPTIVE"];
const HOUSE_COLORS: Record<House, string> = {
  RED: "#DC2626",
  GREEN: "#16A34A",
  BLUE: "#2563EB",
  YELLOW: "#CA8A04",
};

export default function AgentPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [name, setName] = useState("");
  const [house, setHouse] = useState<House>("RED");
  const [strategyProfile, setStrategyProfile] = useState<StrategyProfile>("AGGRESSIVE");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAgents = async () => {
    setError(null);
    try {
      const res = await fetch("/api/agents", { cache: "no-store" });
      const data = (await res.json()) as { agents?: Agent[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load agents");
      setAgents(data.agents ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load agents");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAgents();
  }, []);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          house,
          strategyProfile,
        }),
      });

      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to create agent");

      setName("");
      await loadAgents();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create agent");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#05070C] px-6 py-10 text-zinc-100">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <header className="space-y-2">
          <p className="text-xs tracking-[0.3em] text-zinc-400">INTERHOUSE AGENT PAGE</p>
          <h1 className="text-3xl font-semibold">Build Agent</h1>
        </header>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
          <form className="grid gap-4 md:grid-cols-4" onSubmit={onSubmit}>
            <label className="grid gap-2 text-sm md:col-span-2">
              Name
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none focus:border-zinc-500"
                placeholder="Crimson Fang"
              />
            </label>

            <label className="grid gap-2 text-sm">
              House
              <select
                value={house}
                onChange={(e) => setHouse(e.target.value as House)}
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none focus:border-zinc-500"
              >
                {HOUSES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm">
              Strategy
              <select
                value={strategyProfile}
                onChange={(e) => setStrategyProfile(e.target.value as StrategyProfile)}
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none focus:border-zinc-500"
              >
                {STRATEGIES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="md:col-span-4 rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 disabled:opacity-40"
            >
              {isSubmitting ? "Creating..." : "Create Agent"}
            </button>
          </form>
          {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
          <h2 className="text-xl font-semibold">Agents</h2>
          {isLoading ? <p className="mt-4 text-sm text-zinc-400">Loading agents...</p> : null}
          {!isLoading && agents.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-400">No agents yet.</p>
          ) : null}

          <div className="mt-4 grid gap-3">
            {agents.map((agent) => (
              <article
                key={agent.id}
                onClick={() => setSelectedAgentId(agent.id)}
                className="grid gap-3 cursor-pointer rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 md:grid-cols-6 hover:border-zinc-700 transition-colors"
              >
                <div className="md:col-span-2">
                  <p className="font-medium">{agent.name}</p>
                  <span
                    className="mt-2 inline-block rounded-full px-2 py-1 text-xs font-semibold text-white"
                    style={{ backgroundColor: HOUSE_COLORS[agent.house] }}
                  >
                    {agent.house}
                  </span>
                </div>
                <p className="text-sm text-zinc-300">Tier: {agent.tier}</p>
                <p className="text-sm text-zinc-300">
                  W/L: {agent.wins}/{agent.losses}
                </p>
                <p className="text-sm text-zinc-300">Credits: {agent.credits}</p>
                <p className="text-sm text-zinc-300">Strategy: {agent.strategyProfile}</p>
              </article>
            ))}
          </div>
        </section>

        {selectedAgentId && (
          <AgentDetailModal 
            agentId={selectedAgentId} 
            onClose={() => setSelectedAgentId(null)} 
          />
        )}
      </div>
    </main>
  );
}
