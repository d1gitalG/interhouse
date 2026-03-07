import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { getAgentMove } from "@/lib/agent-engine";
import { settleLockedMatchStakeCredits } from "@/lib/credits";
import { prisma } from "@/lib/prisma";
import { checkSeriesWinner, resolveRPS, type RpsMove } from "@/lib/rps-engine";

const MATCH_INCLUDE = {
  participants: { include: { agent: true } },
  moves: { orderBy: { createdAt: "asc" as const } },
} as const;

type MatchWithRelations = Prisma.MatchGetPayload<{
  include: typeof MATCH_INCLUDE;
}>;

function toRpsMove(rawMove: string): RpsMove | null {
  const normalized = rawMove.toUpperCase();
  if (normalized === "ROCK" || normalized === "PAPER" || normalized === "SCISSORS") {
    return normalized;
  }
  return null;
}

export async function POST(_req: Request, ctx: { params: Promise<{ matchId: string }> }) {
  const params = await ctx.params;

  const match = await prisma.match.findUnique({
    where: { id: params.matchId },
    include: MATCH_INCLUDE,
  });
  if (!match) {
    return NextResponse.json({ error: "MATCH_NOT_FOUND" }, { status: 404 });
  }
  if (match.status !== "ACTIVE") {
    return NextResponse.json({ error: "MATCH_NOT_ACTIVE" }, { status: 409 });
  }
  if (match.game !== "RPS") {
    return NextResponse.json({ error: "UNSUPPORTED_GAME" }, { status: 409 });
  }
  if (match.participants.length !== 2) {
    return NextResponse.json({ error: "MATCH_NOT_READY" }, { status: 409 });
  }

  const p1 = match.participants.find((p) => p.isCreator) ?? match.participants[0];
  const p2 = match.participants.find((p) => p.id !== p1.id) ?? null;
  if (!p2) {
    return NextResponse.json({ error: "INVALID_PARTICIPANTS" }, { status: 409 });
  }

  const round = match.currentRound;
  const moveHistory = match.moves.map((move) => ({
    agentId: move.agentId,
    move: move.move,
    round: move.round,
  }));

  const [p1Result, p2Result] = await Promise.all([
    getAgentMove(
      {
        game: "RPS",
        round,
        availableMoves: ["ROCK", "PAPER", "SCISSORS"],
        moveHistory,
      },
      {
        strategyProfile: p1.agent.strategyProfile,
        tier: p1.agent.tier,
        toolsEnabled: Array.isArray(p1.agent.toolsEnabled)
          ? p1.agent.toolsEnabled.map((tool) => String(tool))
          : [],
        customSystemPrompt: p1.agent.customSystemPrompt ?? undefined,
        agentName: p1.agent.name,
        house: p1.agent.house,
      }
    ),
    getAgentMove(
      {
        game: "RPS",
        round,
        availableMoves: ["ROCK", "PAPER", "SCISSORS"],
        moveHistory,
      },
      {
        strategyProfile: p2.agent.strategyProfile,
        tier: p2.agent.tier,
        toolsEnabled: Array.isArray(p2.agent.toolsEnabled)
          ? p2.agent.toolsEnabled.map((tool) => String(tool))
          : [],
        customSystemPrompt: p2.agent.customSystemPrompt ?? undefined,
        agentName: p2.agent.name,
        house: p2.agent.house,
      }
    ),
  ]);

  const p1Move = toRpsMove(p1Result.move);
  const p2Move = toRpsMove(p2Result.move);
  if (!p1Move || !p2Move) {
    return NextResponse.json({ error: "INVALID_RPS_MOVE" }, { status: 409 });
  }

  let updatedMatch: MatchWithRelations | null = null;
  let outcome: ReturnType<typeof resolveRPS> = "DRAW";

  try {
    const txResult = await prisma.$transaction(async (tx) => {
      // Take a write lock early so concurrent /tick calls serialize on this match row.
      await tx.match.update({
        where: { id: match.id },
        data: { currentRound: { increment: 0 } },
      });

      const matchInTx = await tx.match.findUnique({
        where: { id: match.id },
        include: { participants: true },
      });
      if (!matchInTx) throw new Error("MATCH_NOT_FOUND");
      if (matchInTx.status !== "ACTIVE") throw new Error("MATCH_NOT_ACTIVE");
      if (matchInTx.game !== "RPS") throw new Error("UNSUPPORTED_GAME");
      if (matchInTx.participants.length !== 2) throw new Error("MATCH_NOT_READY");
      if (matchInTx.currentRound !== round) throw new Error("ROUND_ADVANCED");

      const p1InTx = matchInTx.participants.find((participant) => participant.isCreator) ?? matchInTx.participants[0];
      const p2InTx = matchInTx.participants.find((participant) => participant.id !== p1InTx.id) ?? null;
      if (!p2InTx) throw new Error("INVALID_PARTICIPANTS");

      const existingRoundMoves = await tx.move.findMany({
        where: {
          matchId: matchInTx.id,
          round,
        },
        select: { id: true },
      });
      if (existingRoundMoves.length > 0) throw new Error("ROUND_ALREADY_PROCESSED");

      await tx.move.create({
        data: {
          matchId: matchInTx.id,
          agentId: p1InTx.agentId,
          round,
          move: p1Move,
          reasoning: p1Result.reasoning,
        },
      });
      await tx.move.create({
        data: {
          matchId: matchInTx.id,
          agentId: p2InTx.agentId,
          round,
          move: p2Move,
          reasoning: p2Result.reasoning,
        },
      });

      const roundOutcome = resolveRPS(p1Move, p2Move);
      let p1Score = p1InTx.score;
      let p2Score = p2InTx.score;

      if (roundOutcome === "P1_WIN") {
        p1Score += 1;
        await tx.matchParticipant.update({
          where: { id: p1InTx.id },
          data: { score: { increment: 1 } },
        });
      } else if (roundOutcome === "P2_WIN") {
        p2Score += 1;
        await tx.matchParticipant.update({
          where: { id: p2InTx.id },
          data: { score: { increment: 1 } },
        });
      }

      const seriesWinner = checkSeriesWinner(p1Score, p2Score, matchInTx.series);
      if (seriesWinner) {
        const winner = seriesWinner === "P1" ? p1InTx : p2InTx;
        const loser = seriesWinner === "P1" ? p2InTx : p1InTx;

        await tx.match.update({
          where: { id: matchInTx.id },
          data: {
            status: "COMPLETED",
            winnerId: winner.agentId,
          },
        });
        await tx.agentProfile.update({
          where: { id: winner.agentId },
          data: { wins: { increment: 1 } },
        });
        await tx.agentProfile.update({
          where: { id: loser.agentId },
          data: { losses: { increment: 1 } },
        });

        if (matchInTx.stakeMode === "CREDITS") {
          await settleLockedMatchStakeCredits({
            tx,
            matchId: matchInTx.id,
            winnerAgentId: winner.agentId,
            loserAgentId: loser.agentId,
          });
        }
      } else {
        await tx.match.update({
          where: { id: matchInTx.id },
          data: { currentRound: { increment: 1 } },
        });
      }

      const refreshedMatch = await tx.match.findUnique({
        where: { id: matchInTx.id },
        include: MATCH_INCLUDE,
      });
      if (!refreshedMatch) throw new Error("MATCH_NOT_FOUND");

      return {
        refreshedMatch,
        outcome: roundOutcome,
      };
    });

    updatedMatch = txResult.refreshedMatch;
    outcome = txResult.outcome;
  } catch (error) {
    const message = error instanceof Error ? error.message : "TICK_FAILED";
    if (
      message === "MATCH_NOT_FOUND" ||
      message === "MATCH_NOT_ACTIVE" ||
      message === "MATCH_NOT_READY" ||
      message === "INVALID_PARTICIPANTS" ||
      message === "ROUND_ALREADY_PROCESSED" ||
      message === "ROUND_ADVANCED" ||
      message === "UNSUPPORTED_GAME" ||
      message === "STAKE_NOT_LOCKED"
    ) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    throw error;
  }

  if (!updatedMatch) {
    return NextResponse.json({ error: "TICK_FAILED" }, { status: 500 });
  }

  const winnerParticipant =
    updatedMatch.winnerId == null
      ? null
      : updatedMatch.participants.find((participant) => participant.agentId === updatedMatch.winnerId) ?? null;

  return NextResponse.json({
    round,
    p1Move: {
      agentId: p1.agentId,
      move: p1Move,
      reasoning: p1Result.reasoning,
    },
    p2Move: {
      agentId: p2.agentId,
      move: p2Move,
      reasoning: p2Result.reasoning,
    },
    outcome,
    match: updatedMatch,
    winner: winnerParticipant ? { id: winnerParticipant.id, agent: winnerParticipant.agent } : null,
  });
}
