import { NextResponse } from "next/server";
import type { SeriesType } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type AgentStat = {
  id: string;
  name: string;
  house: string;
  wins: number;
  losses: number;
  winRate: number;
  credits: number;
  xp: number;
  tier: string;
};

type HouseStat = {
  house: string;
  wins: number;
  losses: number;
  agentCount: number;
  totalCredits: number;
};

type MatchTrendPoint = {
  date: string;
  count: number;
  stakeSum: number;
};

type SeriesStat = {
  series: string;
  matchCount: number;
  completedCount: number;
};

const SERIES_ORDER: SeriesType[] = ["QUICK", "BO3", "BO5"];

export async function GET() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [topAgents, trendMatches, seriesCounts, completedSeriesCounts, creditsMatches] = await Promise.all([
    prisma.agentProfile.findMany({
      orderBy: { wins: "desc" },
      take: 20,
      select: {
        id: true,
        name: true,
        house: true,
        wins: true,
        losses: true,
        credits: true,
        xp: true,
        tier: true,
      },
    }),
    prisma.match.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: {
        createdAt: true,
        stakeMode: true,
        stakeAmount: true,
      },
    }),
    prisma.match.groupBy({
      by: ["series"],
      _count: { _all: true },
    }),
    prisma.match.groupBy({
      by: ["series"],
      where: { status: "COMPLETED" },
      _count: { _all: true },
    }),
    prisma.match.findMany({
      where: { stakeMode: "CREDITS" },
      select: {
        stakeAmount: true,
        creditsLockedAt: true,
        creditsSettledAt: true,
      },
    }),
  ]);

  const agentStats: AgentStat[] = topAgents.map((agent) => {
    const total = agent.wins + agent.losses;
    return {
      id: agent.id,
      name: agent.name,
      house: agent.house,
      wins: agent.wins,
      losses: agent.losses,
      winRate: total > 0 ? agent.wins / total : 0,
      credits: agent.credits,
      xp: agent.xp,
      tier: agent.tier,
    };
  });

  const houseMap = new Map<string, HouseStat>();
  for (const agent of agentStats) {
    const existing = houseMap.get(agent.house) ?? {
      house: agent.house,
      wins: 0,
      losses: 0,
      agentCount: 0,
      totalCredits: 0,
    };

    existing.wins += agent.wins;
    existing.losses += agent.losses;
    existing.agentCount += 1;
    existing.totalCredits += agent.credits;
    houseMap.set(agent.house, existing);
  }
  const houseStats = Array.from(houseMap.values());

  const trendMap = new Map<string, MatchTrendPoint>();
  for (const match of trendMatches) {
    const date = match.createdAt.toISOString().slice(0, 10);
    const existing = trendMap.get(date) ?? { date, count: 0, stakeSum: 0 };
    existing.count += 1;
    existing.stakeSum += match.stakeAmount;
    trendMap.set(date, existing);
  }
  const matchTrend = Array.from(trendMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  const totalSeriesMap = new Map<SeriesType, number>(seriesCounts.map((row) => [row.series, row._count._all]));
  const completedSeriesMap = new Map<SeriesType, number>(
    completedSeriesCounts.map((row) => [row.series, row._count._all]),
  );
  const seriesStats: SeriesStat[] = SERIES_ORDER.map((series) => ({
    series,
    matchCount: totalSeriesMap.get(series) ?? 0,
    completedCount: completedSeriesMap.get(series) ?? 0,
  }));

  let totalStaked = 0;
  let totalSettled = 0;
  for (const match of creditsMatches) {
    if (match.creditsLockedAt) {
      totalStaked += match.stakeAmount;
    }
    if (match.creditsSettledAt) {
      totalSettled += match.stakeAmount;
    }
  }
  const creditFlow = {
    totalStaked,
    totalSettled,
    inFlight: totalStaked - totalSettled,
  };

  return NextResponse.json({
    houseStats,
    agentStats,
    matchTrend,
    seriesStats,
    creditFlow,
  });
}
