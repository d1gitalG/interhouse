"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AgentDetailModal } from "@/components/AgentDetailModal";

type House = "RED" | "GREEN" | "BLUE" | "YELLOW";
type Series = "QUICK" | "BO3" | "BO5";

type HouseStat = {
  house: House;
  wins: number;
  losses: number;
  agentCount: number;
  totalCredits: number;
};

type AgentStat = {
  id: string;
  name: string;
  house: House;
  wins: number;
  losses: number;
  winRate: number;
  credits: number;
  xp: number;
  tier: string;
};

type MatchTrendPoint = {
  date: string;
  count: number;
  stakeSum: number;
};

type SeriesStat = {
  series: Series;
  matchCount: number;
  completedCount: number;
};

type CreditFlow = {
  totalStaked: number;
  totalSettled: number;
  inFlight: number;
};

type AnalyticsResponse = {
  houseStats: HouseStat[];
  agentStats: AgentStat[];
  matchTrend: MatchTrendPoint[];
  seriesStats: SeriesStat[];
  creditFlow: CreditFlow;
};

const HOUSE_ORDER: House[] = ["RED", "GREEN", "BLUE", "YELLOW"];
const SERIES_ORDER: Series[] = ["QUICK", "BO3", "BO5"];

const houseColors: Record<House, { text: string; bg: string; border: string }> = {
  RED: { text: "#FCA5A5", bg: "rgba(239, 68, 68, 0.12)", border: "rgba(239, 68, 68, 0.35)" },
  GREEN: { text: "#86EFAC", bg: "rgba(34, 197, 94, 0.12)", border: "rgba(34, 197, 94, 0.35)" },
  BLUE: { text: "#93C5FD", bg: "rgba(59, 130, 246, 0.12)", border: "rgba(59, 130, 246, 0.35)" },
  YELLOW: { text: "#FDE047", bg: "rgba(250, 204, 21, 0.12)", border: "rgba(250, 204, 21, 0.35)" },
};

const toDateKey = (date: Date) => date.toISOString().slice(0, 10);

const toCompactDate = (dateKey: string) =>
  new Date(`${dateKey}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric" });

const percentOrDash = (value: number, denominator: number) => {
  if (denominator <= 0) return "-";
  return `${Math.round((value / denominator) * 100)}%`;
};

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/analytics", { cache: "no-store" });
        const json = (await res.json()) as Partial<AnalyticsResponse> & { error?: string };
        if (!res.ok) throw new Error(json.error ?? "Failed to load analytics");
        if (!isMounted) return;
        setData({
          houseStats: json.houseStats ?? [],
          agentStats: json.agentStats ?? [],
          matchTrend: json.matchTrend ?? [],
          seriesStats: json.seriesStats ?? [],
          creditFlow: json.creditFlow ?? { totalStaked: 0, totalSettled: 0, inFlight: 0 },
        });
      } catch (e) {
        if (!isMounted) return;
        setError(e instanceof Error ? e.message : "Failed to load analytics");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void run();
    return () => {
      isMounted = false;
    };
  }, []);

  const normalizedHouseStats = useMemo(() => {
    const source = data?.houseStats ?? [];
    const map = new Map(source.map((item) => [item.house, item]));
    return HOUSE_ORDER.map((house) => {
      const existing = map.get(house);
      return (
        existing ?? {
          house,
          wins: 0,
          losses: 0,
          agentCount: 0,
          totalCredits: 0,
        }
      );
    }).sort((a, b) => b.wins - a.wins);
  }, [data?.houseStats]);

  const trendBars = useMemo(() => {
    const map = new Map((data?.matchTrend ?? []).map((point) => [point.date, point.count]));
    const days = 30;
    const rows: Array<{ date: string; count: number }> = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = days - 1; i >= 0; i -= 1) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const date = toDateKey(d);
      rows.push({ date, count: map.get(date) ?? 0 });
    }
    return rows;
  }, [data?.matchTrend]);

  const maxTrendCount = useMemo(() => {
    if (trendBars.length === 0) return 0;
    return trendBars.reduce((max, item) => Math.max(max, item.count), 0);
  }, [trendBars]);

  const totalMatches = useMemo(() => {
    return (data?.seriesStats ?? []).reduce((acc, row) => acc + row.matchCount, 0);
  }, [data?.seriesStats]);

  const activeAgents = data?.agentStats.length ?? 0;
  const totalCreditsStaked = data?.creditFlow.totalStaked ?? 0;

  const seriesStatsMap = useMemo(() => {
    const map = new Map<Series, SeriesStat>();
    for (const row of data?.seriesStats ?? []) map.set(row.series, row);
    return map;
  }, [data?.seriesStats]);

  const topAgents = data?.agentStats ?? [];

  return (
    <main className="min-h-screen bg-[#05070C] px-6 py-10 text-zinc-100">
      <div className="mx-auto w-full max-w-7xl space-y-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs tracking-[0.3em] text-zinc-400">INTERHOUSE ANALYTICS</p>
            <h1 className="text-3xl font-semibold">Performance Dashboard</h1>
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

        {error ? (
          <section className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </section>
        ) : null}

        <section className="grid gap-4 md:grid-cols-3">
          {isLoading ? (
            <>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 text-sm text-zinc-400">Loading total matches...</div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 text-sm text-zinc-400">Loading active agents...</div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 text-sm text-zinc-400">Loading staked credits...</div>
            </>
          ) : (
            <>
              <article className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
                <p className="text-[10px] font-bold tracking-widest text-zinc-500">TOTAL MATCHES</p>
                <p className="mt-2 text-3xl font-mono font-bold">{totalMatches.toLocaleString()}</p>
              </article>
              <article className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
                <p className="text-[10px] font-bold tracking-widest text-zinc-500">ACTIVE AGENTS</p>
                <p className="mt-2 text-3xl font-mono font-bold">{activeAgents.toLocaleString()}</p>
              </article>
              <article className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
                <p className="text-[10px] font-bold tracking-widest text-zinc-500">TOTAL CREDITS STAKED</p>
                <p className="mt-2 text-3xl font-mono font-bold">{totalCreditsStaked.toLocaleString()}</p>
              </article>
            </>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">House Standings</h2>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Sorted by wins</p>
          </div>
          {isLoading ? (
            <p className="mt-4 text-sm text-zinc-400">Loading house standings...</p>
          ) : normalizedHouseStats.every((row) => row.agentCount === 0) ? (
            <p className="mt-4 text-sm text-zinc-400">No house data yet.</p>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {normalizedHouseStats.map((row) => {
                const colors = houseColors[row.house];
                return (
                  <article key={row.house} className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
                    <p
                      className="inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-widest"
                      style={{
                        color: colors.text,
                        backgroundColor: colors.bg,
                        borderColor: colors.border,
                      }}
                    >
                      HOUSE {row.house}
                    </p>
                    <div className="mt-4 grid gap-2 text-sm text-zinc-300">
                      <p>
                        <span className="text-zinc-500">Wins:</span> {row.wins.toLocaleString()}
                      </p>
                      <p>
                        <span className="text-zinc-500">Agents:</span> {row.agentCount.toLocaleString()}
                      </p>
                      <p>
                        <span className="text-zinc-500">Credits:</span> {row.totalCredits.toLocaleString()}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
          <h2 className="text-xl font-semibold">Top Agents</h2>
          {isLoading ? (
            <p className="mt-4 text-sm text-zinc-400">Loading top agents...</p>
          ) : topAgents.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-400">No agent performance data yet.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[900px] border-separate border-spacing-y-2 text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-zinc-500">
                    <th className="px-3 py-2">Rank</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">House</th>
                    <th className="px-3 py-2">W</th>
                    <th className="px-3 py-2">L</th>
                    <th className="px-3 py-2">Win%</th>
                    <th className="px-3 py-2">Credits</th>
                    <th className="px-3 py-2">XP</th>
                    <th className="px-3 py-2">Tier</th>
                  </tr>
                </thead>
                <tbody>
                  {topAgents.map((agent, index) => {
                    const colors = houseColors[agent.house];
                    return (
                      <tr
                        key={agent.id}
                        onClick={() => setSelectedAgentId(agent.id)}
                        className="cursor-pointer rounded-xl border border-zinc-800 bg-zinc-950/70 text-zinc-200 hover:border-zinc-600"
                      >
                        <td className="rounded-l-xl px-3 py-3 font-mono">{index + 1}</td>
                        <td className="px-3 py-3 font-medium">{agent.name}</td>
                        <td className="px-3 py-3">
                          <span
                            className="inline-flex rounded-full border px-2 py-0.5 text-xs font-medium"
                            style={{
                              color: colors.text,
                              backgroundColor: colors.bg,
                              borderColor: colors.border,
                            }}
                          >
                            {agent.house}
                          </span>
                        </td>
                        <td className="px-3 py-3 font-mono">{agent.wins}</td>
                        <td className="px-3 py-3 font-mono">{agent.losses}</td>
                        <td className="px-3 py-3 font-mono">{percentOrDash(agent.wins, agent.wins + agent.losses)}</td>
                        <td className="px-3 py-3 font-mono">{agent.credits.toLocaleString()}</td>
                        <td className="px-3 py-3 font-mono">{agent.xp.toLocaleString()}</td>
                        <td className="rounded-r-xl px-3 py-3">{agent.tier}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
          <h2 className="text-xl font-semibold">Match Volume Trend</h2>
          {isLoading ? (
            <p className="mt-4 text-sm text-zinc-400">Loading match trend...</p>
          ) : trendBars.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-400">No match trend data for the past 30 days.</p>
          ) : (
            <div className="mt-6">
              <div className="grid h-44 grid-cols-[repeat(30,minmax(0,1fr))] items-end gap-1">
                {trendBars.map((point) => {
                  const height = maxTrendCount > 0 ? Math.max(4, Math.round((point.count / maxTrendCount) * 100)) : 4;
                  return (
                    <div key={point.date} className="flex flex-col items-center justify-end">
                      <div
                        className="w-full rounded-sm bg-zinc-300/70 transition-all hover:bg-zinc-200"
                        style={{ height: `${height}%` }}
                        title={`${point.date}: ${point.count} matches`}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 grid grid-cols-[repeat(30,minmax(0,1fr))] gap-1 text-[10px] text-zinc-500">
                {trendBars.map((point, index) => (
                  <div key={point.date} className="truncate text-center">
                    {index % 7 === 0 ? toCompactDate(point.date) : ""}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
          <h2 className="text-xl font-semibold">Win Rate by Series</h2>
          {isLoading ? (
            <p className="mt-4 text-sm text-zinc-400">Loading series performance...</p>
          ) : (data?.seriesStats.length ?? 0) === 0 ? (
            <p className="mt-4 text-sm text-zinc-400">No series performance data yet.</p>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {SERIES_ORDER.map((series) => {
                const row = seriesStatsMap.get(series) ?? { series, matchCount: 0, completedCount: 0 };
                return (
                  <article key={series} className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
                    <p className="text-[10px] font-bold tracking-widest text-zinc-500">{series}</p>
                    <p className="mt-2 text-2xl font-mono font-bold">
                      {percentOrDash(row.completedCount, row.matchCount)}
                    </p>
                    <p className="mt-1 text-xs text-zinc-400">
                      {row.completedCount.toLocaleString()} completed / {row.matchCount.toLocaleString()} matches
                    </p>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
          <h2 className="text-xl font-semibold">Credit Flow</h2>
          {isLoading ? (
            <p className="mt-4 text-sm text-zinc-400">Loading credit flow...</p>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <article className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
                <p className="text-[10px] font-bold tracking-widest text-zinc-500">TOTAL STAKED</p>
                <p className="mt-2 text-2xl font-mono font-bold">{(data?.creditFlow.totalStaked ?? 0).toLocaleString()}</p>
              </article>
              <article className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
                <p className="text-[10px] font-bold tracking-widest text-zinc-500">TOTAL SETTLED</p>
                <p className="mt-2 text-2xl font-mono font-bold">{(data?.creditFlow.totalSettled ?? 0).toLocaleString()}</p>
              </article>
              <article className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
                <p className="text-[10px] font-bold tracking-widest text-zinc-500">IN-FLIGHT</p>
                <p className="mt-2 text-2xl font-mono font-bold">{(data?.creditFlow.inFlight ?? 0).toLocaleString()}</p>
              </article>
            </div>
          )}
        </section>

        {selectedAgentId ? <AgentDetailModal agentId={selectedAgentId} onClose={() => setSelectedAgentId(null)} /> : null}
      </div>
    </main>
  );
}
