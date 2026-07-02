"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
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

type SlotStatus = {
  agentSlots: number;
  agentsUsed: number;
  maxSlots: number;
  winsRequiredForNextSlot: number;
  creditsCost: number;
};

const HOUSES: House[] = ["RED", "GREEN", "BLUE", "YELLOW"];
const STRATEGIES: StrategyProfile[] = ["AGGRESSIVE", "DEFENSIVE", "CHAOTIC", "CALCULATED", "ADAPTIVE"];
const DIRECTIVE_MAX_LENGTH = 500;
const WALLET_STORAGE_KEY = "interhouse.walletAddress";
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
  const [walletAddress, setWalletAddress] = useState("");
  const [customDirective, setCustomDirective] = useState("");
  const [slotStatus, setSlotStatus] = useState<SlotStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSlotStatus = useCallback(async (address: string) => {
    const trimmed = address.trim();
    if (!trimmed) {
      setSlotStatus(null);
      return;
    }

    try {
      const res = await fetch("/api/agents/slots", {
        cache: "no-store",
        headers: { "x-address": trimmed },
      });
      const data = (await res.json()) as SlotStatus & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load slot status");
      setSlotStatus({
        agentSlots: data.agentSlots,
        agentsUsed: data.agentsUsed,
        maxSlots: data.maxSlots,
        winsRequiredForNextSlot: data.winsRequiredForNextSlot,
        creditsCost: data.creditsCost,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load slot status");
    }
  }, []);

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
    const storedWalletAddress = window.localStorage.getItem(WALLET_STORAGE_KEY);
    if (storedWalletAddress) {
      setWalletAddress(storedWalletAddress);
      void loadSlotStatus(storedWalletAddress);
    }
  }, [loadSlotStatus]);

  const persistWalletAddress = (value: string) => {
    setWalletAddress(value);
    window.localStorage.setItem(WALLET_STORAGE_KEY, value);
  };

  const unlockSlot = async (method: "WINS" | "CREDITS") => {
    const trimmedWallet = walletAddress.trim();
    if (!trimmedWallet) {
      setError("Enter a wallet address before unlocking a slot");
      return;
    }

    setIsUnlocking(true);
    setError(null);

    try {
      const creditAgent = agents.find((agent) => agent.credits >= (slotStatus?.creditsCost ?? 500)) ?? agents[0];
      const body = method === "WINS" ? { method } : { method, agentId: creditAgent?.id };
      const res = await fetch("/api/agents/slots/unlock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-address": trimmedWallet,
        },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to unlock slot");

      await loadSlotStatus(trimmedWallet);
      await loadAgents();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to unlock slot");
    } finally {
      setIsUnlocking(false);
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedWallet = walletAddress.trim();
    if (!trimmedWallet) {
      setError("Enter a wallet address before creating an agent");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-address": trimmedWallet,
        },
        body: JSON.stringify({
          name: name.trim(),
          house,
          strategyProfile,
          ...(customDirective.trim() ? { customSystemPrompt: customDirective.trim() } : {}),
        }),
      });

      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to create agent");

      setName("");
      setCustomDirective("");
      await loadSlotStatus(trimmedWallet);
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
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <p className="text-xs tracking-[0.3em] text-zinc-400">INTERHOUSE AGENT PAGE</p>
            <h1 className="text-3xl font-semibold">Build Agent</h1>
          </div>
          <nav className="flex flex-wrap gap-3">
            <Link href="/lobby" className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-100 hover:border-zinc-500">
              Lobby
            </Link>
            <Link href="/tournaments" className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-100 hover:border-amber-300/70">
              Tournaments
            </Link>
            <Link href="/" className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-100 hover:border-zinc-500">
              Home
            </Link>
          </nav>
        </header>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
          <form className="grid gap-4 md:grid-cols-4" onSubmit={onSubmit}>
            <label className="grid gap-2 text-sm md:col-span-4">
              Wallet address
              <input
                required
                value={walletAddress}
                onBlur={() => void loadSlotStatus(walletAddress)}
                onChange={(e) => persistWalletAddress(e.target.value)}
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none focus:border-zinc-500"
                placeholder="demo-wallet-001"
              />
            </label>

            <div className="md:col-span-4 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-sm text-zinc-300">
              {slotStatus ? (
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <p>
                    Slot {slotStatus.agentsUsed} of {slotStatus.agentSlots} used
                    {slotStatus.agentSlots < slotStatus.maxSlots
                      ? ` - unlock the next: win ${slotStatus.winsRequiredForNextSlot} matches or ${slotStatus.creditsCost} CR`
                      : " - max slots reached"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={isUnlocking || slotStatus.agentSlots >= slotStatus.maxSlots}
                      onClick={() => void unlockSlot("WINS")}
                      className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-100 hover:border-zinc-500 disabled:opacity-40"
                    >
                      Unlock with wins
                    </button>
                    <button
                      type="button"
                      disabled={isUnlocking || slotStatus.agentSlots >= slotStatus.maxSlots || agents.length === 0}
                      onClick={() => void unlockSlot("CREDITS")}
                      className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-100 hover:border-amber-300/70 disabled:opacity-40"
                    >
                      Unlock with CR
                    </button>
                  </div>
                </div>
              ) : (
                <p>Enter a wallet address to view slot status.</p>
              )}
            </div>

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

            <details className="md:col-span-4 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
              <summary className="cursor-pointer text-sm font-medium text-zinc-100">
                Advanced: custom directive (optional)
              </summary>
              <div className="mt-3 grid gap-2">
                <textarea
                  value={customDirective}
                  maxLength={DIRECTIVE_MAX_LENGTH}
                  onChange={(e) => setCustomDirective(e.target.value)}
                  className="min-h-28 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                  placeholder="Prefer careful openings and adapt after each loss."
                />
                <div className="flex flex-col gap-2 text-xs text-zinc-400 md:flex-row md:items-center md:justify-between">
                  <p>
                    Appended to your agent&apos;s vetted base prompt. Length-capped and filtered. Every move your agent makes is recorded in the public audit trail.
                  </p>
                  <p className="shrink-0">
                    {customDirective.length}/{DIRECTIVE_MAX_LENGTH}
                  </p>
                </div>
              </div>
            </details>

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
