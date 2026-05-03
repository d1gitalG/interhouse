"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AgentDetailModal } from "@/components/AgentDetailModal";
import CreateMatchForm from "@/components/CreateMatchForm";
import { deriveCharacterSummary } from "@/lib/character-presentation";

type Match = {
  id: string;
  game: "RPS" | "TTT" | "C4" | "CHESS" | "CHECKERS";
  series: "QUICK" | "BO3" | "BO5";
  stakeMode: "CREDITS" | "SOL";
  stakeAmount: number;
  status: "WAITING" | "ACTIVE" | "COMPLETED" | "CANCELLED";
  createdAt?: string;
  participants?: Array<{
    agentId: string;
    agent?: {
      id: string;
      name: string;
      house: "RED" | "GREEN" | "BLUE" | "YELLOW";
    };
  }>;
};

type Agent = {
  id: string;
  name: string;
  house: "RED" | "GREEN" | "BLUE" | "YELLOW";
  strategyProfile?: string | null;
  wins: number;
  losses: number;
  xp: number;
  credits: number;
};

const HISTORY_SERIES_RANK: Record<Match["series"], number> = {
  QUICK: 0,
  BO3: 1,
  BO5: 2,
};

const getHistoryCreditsWon = (match: Match) =>
  match.status === "COMPLETED" && match.stakeMode === "CREDITS" ? match.stakeAmount * 2 : 0;

type HistorySortOrder = "NEWEST" | "OLDEST" | "CREDITS_WON" | "SERIES_TYPE";

export default function LobbyPage() {
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [recentMatches, setRecentMatches] = useState<Match[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showDirectCreate, setShowDirectCreate] = useState(false);
  const [directMatchType, setDirectMatchType] = useState<"SCRIM" | "WAR">("SCRIM");
  const [game, setGame] = useState<"RPS" | "TTT">("RPS");
  const [stakeAmount, setStakeAmount] = useState(100);
  const [series, setSeries] = useState<"QUICK" | "BO3" | "BO5">("QUICK");
  const [creatorAgentId, setCreatorAgentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [joiningMatchId, setJoiningMatchId] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const [filterGame, setFilterGame] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterHouse, setFilterHouse] = useState<string>("ALL");
  const [filterSearch, setFilterSearch] = useState<string>("");
  const [agentSearch, setAgentSearch] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<HistorySortOrder>("NEWEST");

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterGame !== "ALL") params.append("game", filterGame);
      if (filterStatus !== "ALL") params.append("status", filterStatus);
      if (filterHouse !== "ALL") params.append("house", filterHouse);
      const historySortMap: Record<typeof sortOrder, string> = {
        NEWEST: "newest",
        OLDEST: "oldest",
        CREDITS_WON: "credits_won",
        SERIES_TYPE: "series_type",
      };
      params.append("sort", historySortMap[sortOrder]);
      const normalizedSearch = filterSearch.trim();
      if (/^c[a-z0-9]{10,}$/i.test(normalizedSearch)) params.append("agentId", normalizedSearch);

      const [matchesRes, recentMatchesRes, agentsRes] = await Promise.all([
        fetch(`/api/matches?${params.toString()}`, { cache: "no-store" }),
        fetch("/api/matches", { cache: "no-store" }),
        fetch("/api/agents", { cache: "no-store" }),
      ]);
      const matchesData = (await matchesRes.json()) as { matches?: Match[]; error?: string };
      const recentMatchesData = (await recentMatchesRes.json()) as { matches?: Match[]; error?: string };
      const agentsData = (await agentsRes.json()) as { agents?: Agent[]; error?: string };

      if (!matchesRes.ok) throw new Error(matchesData.error ?? "Failed to load matches");
      if (!recentMatchesRes.ok) throw new Error(recentMatchesData.error ?? "Failed to load recent matches");
      if (!agentsRes.ok) throw new Error(agentsData.error ?? "Failed to load agents");

      const loadedAgents = agentsData.agents ?? [];
      setMatches(matchesData.matches ?? []);
      setRecentMatches(recentMatchesData.matches ?? []);
      setAgents(loadedAgents);

      if (!creatorAgentId && loadedAgents.length > 0) {
        setCreatorAgentId(loadedAgents[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load lobby");
    } finally {
      setIsLoading(false);
    }
  }, [creatorAgentId, filterGame, filterStatus, filterHouse, filterSearch, sortOrder]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const onCreateMatch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          game,
          stakeMode: "CREDITS",
          stakeAmount: Number(stakeAmount),
          series,
          creatorAgentId,
        }),
      });

      const data = (await res.json()) as { error?: string; match?: { id: string } };
      if (!res.ok) throw new Error(data.error ?? "Failed to create match");

      await loadData();
      if (data.match?.id) {
        router.push(`/match/${data.match.id}`);
        return;
      }

      setShowCreateForm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create match");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onJoinMatch = async (matchId: string) => {
    if (!creatorAgentId) {
      setError("Select an agent before joining a match.");
      return;
    }
    setJoiningMatchId(matchId);
    setError(null);
    try {
      const res = await fetch(`/api/matches/${matchId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opponentAgentId: creatorAgentId }),
      });
      const data = (await res.json()) as { error?: string; match?: { id: string } };
      if (!res.ok) throw new Error(data.error ?? "Failed to join match");
      await loadData();
      if (data.match?.id) {
        router.push(`/match/${data.match.id}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to join match");
    } finally {
      setJoiningMatchId(null);
    }
  };

  const recentlyActiveAgents = useMemo(() => {
    const byAgentId = new Map<
      string,
      {
        id: string;
        name: string;
        house: "RED" | "GREEN" | "BLUE" | "YELLOW";
        recentMatchId: string;
        recentMatchStatus: Match["status"];
      }
    >();

    for (const match of recentMatches) {
      for (const participant of match.participants ?? []) {
        const agentFromMatch = participant.agent;
        const fallbackAgent = agents.find((agent) => agent.id === participant.agentId);
        const agent =
          agentFromMatch ??
          (fallbackAgent
            ? { id: fallbackAgent.id, name: fallbackAgent.name, house: fallbackAgent.house }
            : null);

        if (!agent || byAgentId.has(agent.id)) continue;

        byAgentId.set(agent.id, {
          id: agent.id,
          name: agent.name,
          house: agent.house,
          recentMatchId: match.id,
          recentMatchStatus: match.status,
        });
      }

      if (byAgentId.size >= 8) break;
    }

    return Array.from(byAgentId.values());
  }, [recentMatches, agents]);

  const sortedAgents = useMemo(() => {
    const search = agentSearch.trim().toLowerCase();
    const list = [...agents].sort((a, b) => b.wins - a.wins);
    if (!search) return list;
    return list.filter(
      (a) => a.name.toLowerCase().includes(search) || a.house.toLowerCase().includes(search) || a.id.toLowerCase().includes(search)
    );
  }, [agents, agentSearch]);

  const houseLeaderboard = useMemo(() => {
    const stats: Record<Agent["house"], { wins: number; agents: number }> = {
      RED: { wins: 0, agents: 0 },
      GREEN: { wins: 0, agents: 0 },
      BLUE: { wins: 0, agents: 0 },
      YELLOW: { wins: 0, agents: 0 },
    };

    for (const agent of agents) {
      if (stats[agent.house]) {
        stats[agent.house].wins += agent.wins;
        stats[agent.house].agents += 1;
      }
    }

    return Object.entries(stats)
      .map(([house, data]) => ({
        house: house as Agent["house"],
        ...data,
      }))
      .sort((a, b) => b.wins - a.wins);
  }, [agents]);

  const houseColors: Record<Agent["house"], { text: string; bg: string; border: string }> = {
    RED: { text: "#FCA5A5", bg: "rgba(239, 68, 68, 0.12)", border: "rgba(239, 68, 68, 0.35)" },
    GREEN: { text: "#86EFAC", bg: "rgba(34, 197, 94, 0.12)", border: "rgba(34, 197, 94, 0.35)" },
    BLUE: { text: "#93C5FD", bg: "rgba(59, 130, 246, 0.12)", border: "rgba(59, 130, 246, 0.35)" },
    YELLOW: { text: "#FDE047", bg: "rgba(250, 204, 21, 0.12)", border: "rgba(250, 204, 21, 0.35)" },
  };

  const filteredMatches = useMemo(() => {
    const query = filterSearch.trim().toLowerCase();
    const result = query
      ? matches.filter((match) => {
          if (match.id.toLowerCase().includes(query)) return true;

          return (match.participants ?? []).some((participant) => {
            const participantAgent =
              participant.agent ?? agents.find((agent) => agent.id === participant.agentId) ?? null;
            if (!participantAgent) return participant.agentId.toLowerCase().includes(query);

            return (
              participantAgent.id.toLowerCase().includes(query) ||
              participantAgent.name.toLowerCase().includes(query) ||
              participantAgent.house.toLowerCase().includes(query)
            );
          });
        })
      : [...matches];

    return result.sort((a, b) => {
      switch (sortOrder) {
        case "NEWEST":
          return (b.createdAt || "").localeCompare(a.createdAt || "");
        case "OLDEST":
          return (a.createdAt || "").localeCompare(b.createdAt || "");
        case "CREDITS_WON": {
          const delta = getHistoryCreditsWon(b) - getHistoryCreditsWon(a);
          if (delta !== 0) return delta;
          return (b.createdAt || "").localeCompare(a.createdAt || "");
        }
        case "SERIES_TYPE": {
          const delta = HISTORY_SERIES_RANK[a.series] - HISTORY_SERIES_RANK[b.series];
          if (delta !== 0) return delta;
          return (b.createdAt || "").localeCompare(a.createdAt || "");
        }
        default:
          return 0;
      }
    });
  }, [matches, agents, filterSearch, sortOrder]);

  const lobbyStats = useMemo(() => {
    let totalMatches = 0;
    let totalVolume = 0;
    let totalActiveStakes = 0;

    for (const match of recentMatches) {
      if (match.stakeMode === "CREDITS") {
        totalMatches++;
        totalVolume += match.stakeAmount;
        if (match.status === "ACTIVE" || match.status === "WAITING") {
          totalActiveStakes += match.stakeAmount;
        }
      }
    }

    return { totalMatches, totalVolume, totalActiveStakes };
  }, [recentMatches]);

  return (
    <main className="min-h-screen bg-[#05070C] px-6 py-10 text-zinc-100">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs tracking-[0.3em] text-zinc-400">INTERHOUSE LOBBY</p>
            <h1 className="text-3xl font-semibold">Matches</h1>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden items-center gap-6 border-r border-zinc-800 pr-6 md:flex">
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-widest text-zinc-500">Volume</p>
                <p className="text-sm font-mono font-bold text-zinc-100">{lobbyStats.totalVolume.toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-widest text-zinc-500">Active</p>
                <p className="text-sm font-mono font-bold text-emerald-400">{lobbyStats.totalActiveStakes.toLocaleString()}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/tournaments" className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-5 py-2 font-medium text-amber-100 hover:border-amber-300/70">
                Tournaments
              </Link>
              <Link href="/analytics" className="rounded-lg border border-zinc-700 px-5 py-2 font-medium text-zinc-100">
                Analytics
              </Link>
              <button
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-100"
                onClick={() => {
                  setShowDirectCreate((prev) => !prev);
                  setShowCreateForm(false);
                }}
              >
                Direct Match
              </button>
              <button
                className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900"
                onClick={() => {
                  setShowCreateForm((prev) => !prev);
                  setShowDirectCreate(false);
                }}
              >
                Create Lobby Match
              </button>
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <Link
            href="/tournaments"
            className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5 transition-colors hover:border-amber-400/50 md:col-span-1"
          >
            <p className="text-xs font-semibold tracking-[0.25em] text-amber-200/80">BRACKETS</p>
            <h2 className="mt-2 text-xl font-semibold text-amber-50">Prize-Pool Tournaments</h2>
            <p className="mt-2 text-sm text-amber-100/70">
              View recent tournament brackets, prize pools, champions, and settlement state.
            </p>
          </Link>
        </section>

        <section className="rounded-2xl border border-sky-500/20 bg-sky-500/10 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold tracking-[0.3em] text-sky-200/80">ON-CHAIN ROADMAP</p>
              <h2 className="mt-2 text-xl font-semibold text-sky-50">Solana escrow and wallet integration</h2>
              <p className="mt-2 text-sm text-sky-100/80">
                The Credits-based match flow is now live. On-chain wallet connection, stake signatures, and real 
                escrow settlement are currently in functional preview.
              </p>
              <p className="mt-3 text-xs text-sky-100/60">
                Next up: integrating wallet adapters for match creation and escrow settlement.
              </p>
            </div>
            <div className="rounded-xl border border-sky-200/20 bg-[#05070C]/40 p-4">
              <p className="text-sm font-medium text-sky-50">Wallet Connection</p>
              <p className="mt-1 text-sm text-sky-100/60">Disconnected (Preview Only)</p>
              <button
                type="button"
                disabled
                className="mt-3 rounded-lg border border-sky-200/20 px-4 py-2 text-sm font-medium text-sky-50 opacity-50 cursor-not-allowed"
              >
                Connect Wallet
              </button>
            </div>
          </div>
        </section>

        {showCreateForm ? (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
            <h3 className="mb-4 text-sm font-bold tracking-widest text-zinc-400">CREATE LOBBY MATCH</h3>
            <form className="grid gap-4 md:grid-cols-4" onSubmit={onCreateMatch}>
              <label className="grid gap-2 text-sm">
                Game
                <select
                  value={game}
                  onChange={(e) => setGame(e.target.value as "RPS" | "TTT")}
                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none focus:border-zinc-500"
                >
                  <option value="RPS">RPS</option>
                  <option value="TTT">TTT</option>
                </select>
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
                      {agent.name} ({agent.house}) — {agent.credits.toLocaleString()} CR
                    </option>
                  ))}
                </select>
              </label>

              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100 md:col-span-4">
                <p className="font-medium text-amber-200">On-chain settlement is currently in preview.</p>
                <p className="mt-1 opacity-80">
                  Matches are currently settled via the internal Credits system while the Solana escrow 
                  integration is being finalized.
                </p>
              </div>

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

        {showDirectCreate ? (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold tracking-widest text-zinc-400">CREATE DIRECT MATCH</h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDirectMatchType("SCRIM")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    directMatchType === "SCRIM" ? "bg-zinc-100 text-zinc-900" : "border border-zinc-700 text-zinc-400"
                  }`}
                >
                  SCRIM
                </button>
                <button
                  type="button"
                  onClick={() => setDirectMatchType("WAR")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    directMatchType === "WAR" ? "bg-zinc-100 text-zinc-900" : "border border-zinc-700 text-zinc-400"
                  }`}
                >
                  WAR
                </button>
              </div>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-1">
              <CreateMatchForm type={directMatchType} />
            </div>
          </section>
        ) : null}

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Top Agents</h2>
            <input
              type="text"
              placeholder="Filter agents by name or house…"
              value={agentSearch}
              onChange={(e) => setAgentSearch(e.target.value)}
              className="w-64 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-1.5 text-xs text-zinc-300 outline-none focus:border-zinc-700"
            />
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {sortedAgents.slice(0, 8).map((agent, index) => (
              <article
                key={agent.id}
                onClick={() => setSelectedAgentId(agent.id)}
                className="relative cursor-pointer group overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 hover:border-zinc-600 transition-colors"
              >
                <div
                  className="absolute right-0 top-0 h-24 w-24 -translate-y-12 translate-x-12 rounded-full opacity-10 group-hover:opacity-20 transition-opacity"
                  style={{
                    backgroundColor:
                      agent.house === "RED"
                        ? "#DC2626"
                        : agent.house === "GREEN"
                        ? "#16A34A"
                        : agent.house === "BLUE"
                        ? "#2563EB"
                        : "#CA8A04",
                  }}
                />
                <p className="text-[10px] font-bold tracking-widest text-zinc-500">RANK #{index + 1}</p>
                <h3 className="mt-1 text-lg font-semibold group-hover:text-white">{agent.name}</h3>
                <div className="flex items-center justify-between">
                  <p
                    className="text-xs font-medium"
                    style={{
                      color:
                        agent.house === "RED"
                          ? "#EF4444"
                          : agent.house === "GREEN"
                          ? "#22C55E"
                          : agent.house === "BLUE"
                          ? "#3B82F6"
                          : "#EAB308",
                    }}
                  >
                    House {agent.house}
                  </p>
                  <p className="text-xs font-mono text-zinc-400 group-hover:text-zinc-200">
                    {agent.credits.toLocaleString()} CR
                  </p>
                </div>

                {(() => {
                  const character = deriveCharacterSummary(agent);
                  return (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <span className="rounded-full border border-zinc-700 bg-zinc-950/80 px-2 py-0.5 text-[10px] text-zinc-300">
                        {character.archetype}
                      </span>
                      <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-200">
                        flaw: {character.flaw}
                      </span>
                    </div>
                  );
                })()}

                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] text-zinc-500">WINS</p>
                    <p className="text-xl font-mono font-bold text-zinc-100 group-hover:text-white">{agent.wins}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-500">XP</p>
                    <p className="text-xl font-mono font-bold text-zinc-100 group-hover:text-white">{agent.xp}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {sortedAgents.length === 0 && (
            <p className="text-sm text-zinc-500">No agents match your filter.</p>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">House Standings</h2>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Aggregate Wins</p>
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            {houseLeaderboard.map((item) => {
              const colors = houseColors[item.house];
              return (
                <div
                  key={item.house}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5"
                >
                  <p
                    className="text-[10px] font-bold tracking-widest"
                    style={{ color: colors.text }}
                  >
                    HOUSE {item.house}
                  </p>
                  <div className="mt-4 flex items-baseline justify-between">
                    <div>
                      <p className="text-[10px] text-zinc-500 uppercase">Total Wins</p>
                      <p className="text-2xl font-mono font-bold text-zinc-100">{item.wins}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-zinc-500 uppercase">Agents</p>
                      <p className="text-lg font-mono font-medium text-zinc-400">{item.agents}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Recently Active</h2>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">From latest matches</p>
          </div>
          {recentlyActiveAgents.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-400">No recent participant activity yet.</p>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {recentlyActiveAgents.map((agent) => (
                <Link
                  key={agent.id}
                  href={`/match/${agent.recentMatchId}`}
                  className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 hover:border-zinc-700"
                >
                  <p className="text-sm font-semibold text-zinc-100">{agent.name}</p>
                  <p
                    className="mt-1 text-xs font-medium"
                    style={{
                      color:
                        agent.house === "RED"
                          ? "#EF4444"
                          : agent.house === "GREEN"
                          ? "#22C55E"
                          : agent.house === "BLUE"
                          ? "#3B82F6"
                          : "#EAB308",
                    }}
                  >
                    House {agent.house}
                  </p>
                  <p className="mt-2 text-xs text-zinc-400">
                    Last seen in match {agent.recentMatchId.slice(0, 8)}… ({agent.recentMatchStatus})
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <h2 className="text-xl font-semibold">Match History</h2>
            <div className="flex flex-wrap gap-2">
              <select
                value={filterGame}
                onChange={(e) => setFilterGame(e.target.value)}
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-300 outline-none focus:border-zinc-500"
              >
                <option value="ALL">All Games</option>
                <option value="RPS">RPS</option>
                <option value="TTT">TTT</option>
                <option value="C4">C4</option>
                <option value="CHESS">CHESS</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-300 outline-none focus:border-zinc-500"
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="WAITING">WAITING</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
              <select
                value={filterHouse}
                onChange={(e) => setFilterHouse(e.target.value)}
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-300 outline-none focus:border-zinc-500"
              >
                <option value="ALL">All Houses</option>
                <option value="RED">Red House</option>
                <option value="GREEN">Green House</option>
                <option value="BLUE">Blue House</option>
                <option value="YELLOW">Yellow House</option>
              </select>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as HistorySortOrder)}
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-300 outline-none focus:border-zinc-500"
              >
                <option value="NEWEST">Newest</option>
                <option value="OLDEST">Oldest</option>
                <option value="CREDITS_WON">Credits Won</option>
                <option value="SERIES_TYPE">Series Type</option>
              </select>
              <input
                type="text"
                placeholder="Search by Agent Name or ID"
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                className="w-48 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-300 outline-none focus:border-zinc-500"
              />
            </div>
          </div>
          {isLoading ? <p className="mt-4 text-sm text-zinc-400">Loading matches...</p> : null}
          {!isLoading && filteredMatches.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-400">No matches found.</p>
          ) : null}

          <div className="mt-4 grid gap-3">
            {filteredMatches.map((match) => {
              const participants = (match.participants ?? []).map((participant) => {
                const participantAgent =
                  participant.agent ?? agents.find((agent) => agent.id === participant.agentId) ?? null;

                return {
                  key: participant.agentId,
                  name: participantAgent?.name ?? `${participant.agentId.slice(0, 8)}…`,
                  house: participantAgent?.house,
                };
              });

              return (
                <div
                  key={match.id}
                  className="grid gap-2 rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 hover:border-zinc-700"
                >
                  <Link href={`/match/${match.id}`} className="text-sm text-zinc-300 hover:text-zinc-100">
                    Match {match.id}
                  </Link>
                  <p className="text-sm text-zinc-300">
                    {match.game} | {match.series} | {match.stakeMode} {match.stakeAmount}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {participants.length > 0 ? (
                      participants.map((participant) => {
                        const colors = participant.house ? houseColors[participant.house] : null;
                        return (
                          <span
                            key={participant.key}
                            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium"
                            style={{
                              color: colors?.text ?? "#D4D4D8",
                              backgroundColor: colors?.bg ?? "rgba(161, 161, 170, 0.12)",
                              borderColor: colors?.border ?? "rgba(161, 161, 170, 0.3)",
                            }}
                          >
                            {participant.name}
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-xs text-zinc-500">No participants yet</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Status: {match.status}</p>
                    {match.status === "WAITING" && (
                      <button
                        type="button"
                        disabled={joiningMatchId === match.id}
                        onClick={() => void onJoinMatch(match.id)}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {joiningMatchId === match.id ? "Joining…" : "Join Match"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
        </section>

        {selectedAgentId && (
          <AgentDetailModal 
            agentId={selectedAgentId} 
            onClose={() => setSelectedAgentId(null)} 
            onDeleted={() => void loadData()}
          />
        )}
      </div>
    </main>
  );
}

