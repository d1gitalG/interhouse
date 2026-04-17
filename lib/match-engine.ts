import type { MatchParticipant, Prisma, SeriesType, StakeMode } from "@prisma/client";

import { settleLockedMatchStakeCredits } from "@/lib/credits";
import { resolveSeriesState } from "./series-engine";

type SeriesParticipant = Pick<MatchParticipant, "id" | "agentId" | "score">;
type SeriesWinner = "P1" | "P2";

export async function finalizeMatchWinner(params: {
  tx: Prisma.TransactionClient;
  matchId: string;
  stakeMode: StakeMode;
  winnerAgentId: string;
  loserAgentId: string;
}) {
  const { tx, matchId, stakeMode, winnerAgentId, loserAgentId } = params;

  await tx.match.update({
    where: { id: matchId },
    data: {
      status: "COMPLETED",
      winnerId: winnerAgentId,
    },
  });

  await tx.agentProfile.update({
    where: { id: winnerAgentId },
    data: { wins: { increment: 1 } },
  });
  await tx.agentProfile.update({
    where: { id: loserAgentId },
    data: { losses: { increment: 1 } },
  });

  if (stakeMode === "CREDITS") {
    await settleLockedMatchStakeCredits({
      tx,
      matchId,
      winnerAgentId,
      loserAgentId,
    });
  }
}

export async function applySeriesRoundOutcome(params: {
  tx: Prisma.TransactionClient;
  matchId: string;
  series: SeriesType;
  stakeMode: StakeMode;
  p1: SeriesParticipant;
  p2: SeriesParticipant;
  roundWinner: SeriesWinner | null;
}) {
  const { tx, matchId, series, stakeMode, p1, p2, roundWinner } = params;

  if (roundWinner === "P1") {
    await tx.matchParticipant.update({
      where: { id: p1.id },
      data: { score: { increment: 1 } },
    });
  } else if (roundWinner === "P2") {
    await tx.matchParticipant.update({
      where: { id: p2.id },
      data: { score: { increment: 1 } },
    });
  }

  const seriesState = resolveSeriesState({
    p1Score: p1.score,
    p2Score: p2.score,
    series,
    roundWinner,
  });

  if (seriesState.seriesWinner) {
    const winner = seriesState.seriesWinner === "P1" ? p1 : p2;
    const loser = seriesState.seriesWinner === "P1" ? p2 : p1;

    await finalizeMatchWinner({
      tx,
      matchId,
      stakeMode,
      winnerAgentId: winner.agentId,
      loserAgentId: loser.agentId,
    });
  } else {
    await tx.match.update({
      where: { id: matchId },
      data: { currentRound: { increment: 1 } },
    });
  }

  return seriesState;
}
