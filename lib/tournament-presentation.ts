import type { GameType, SeriesType } from "@prisma/client";

export type RpsMove = "ROCK" | "PAPER" | "SCISSORS";

export const RPS_MOVES: RpsMove[] = ["ROCK", "PAPER", "SCISSORS"];

export function isRpsMove(move: string): move is RpsMove {
  return RPS_MOVES.includes(move.toUpperCase() as RpsMove);
}

export function normalizeRpsMove(move: string): RpsMove | null {
  const normalized = move.toUpperCase();
  return isRpsMove(normalized) ? normalized : null;
}

export function getRpsMoveLimit(series: SeriesType | string): number {
  if (series === "BO3") return 3;
  if (series === "BO5") return 4;
  return 5;
}

export function getRpsCounter(move: RpsMove): RpsMove {
  if (move === "ROCK") return "PAPER";
  if (move === "PAPER") return "SCISSORS";
  return "ROCK";
}

export function getPublicFormatName(params: {
  game: GameType | string;
  series: SeriesType | string;
  entryFeeCredits?: number;
}) {
  if (params.game !== "RPS") return `${params.game} ${params.series}`;
  if (params.series === "BO3") return "Scarcity Duel";
  if (params.series === "BO5") return "Championship Series";
  return "Quick Clash";
}

export function getFormatExplainer(params: {
  game: GameType | string;
  series: SeriesType | string;
  entryFeeCredits?: number;
}) {
  if (params.game !== "RPS") {
    return "Agents play an autonomous series; inspect the match log to see how the result resolved.";
  }

  if (params.series === "BO3") {
    return "Best-of-3 with only 3 uses of each RPS move. Exhausted counters still matter, but agents get more room to adapt before scarcity decides the late rounds.";
  }

  if (params.series === "BO5") {
    return "Best-of-5 with 4 uses of each RPS move. Longer arcs reward discipline, adaptation, and cleaner late-series resource management.";
  }

  return "Fast RPS showcase format. Use it for quick reads before trusting an agent in deeper brackets.";
}

export function getStakeLabel(params: { entryFeeCredits?: number; prizePoolCredits?: number; stakeAmount?: number }) {
  const entryFee = params.entryFeeCredits ?? params.stakeAmount ?? 0;
  const prizePool = params.prizePoolCredits ?? 0;
  if (entryFee === 0 && prizePool === 0) return "Zero-fee showcase";
  if (entryFee > 0) return `${entryFee.toLocaleString()} CR entry`;
  return `${prizePool.toLocaleString()} CR pool`;
}
