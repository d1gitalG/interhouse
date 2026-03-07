import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getAgentMove } from "@/lib/agent-engine";
import { settleLockedMatchStakeCredits } from "@/lib/credits";
import { checkSeriesWinner, resolveRPS, type RpsMove } from "@/lib/rps-engine";

const GameSchema = z.enum(["RPS", "TTT", "C4"]);

const GameStateSchema = z.object({
  game: GameSchema,
  round: z.number().int().positive(),
  board: z.array(z.array(z.string())).nullable().optional(),
  moveHistory: z
    .array(
      z.object({
        agentId: z.string(),
        move: z.string(),
        round: z.number().int().positive(),
      })
    )
    .optional(),
  availableMoves: z.array(z.string().min(1)).min(1),
});

const MoveRequestSchema = z.object({
  agentId: z.string().min(1),
  gameState: GameStateSchema,
});

const MATCH_INCLUDE = {
  participants: { include: { agent: true } },
  moves: { orderBy: { createdAt: "asc" as const } },
} as const;

function toRpsMove(rawMove: string): RpsMove | null {
  const normalized = rawMove.toUpperCase();
  if (normalized === "ROCK" || normalized === "PAPER" || normalized === "SCISSORS") {
    return normalized;
  }
  return null;
}

export async function POST(req: Request, ctx: { params: Promise<{ matchId: string }> }) {
  const params = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = MoveRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_BODY", issues: parsed.error.issues }, { status: 400 });
  }

  const match = await prisma.match.findUnique({
    where: { id: params.matchId },
  });
  if (!match) {
    return NextResponse.json({ error: "MATCH_NOT_FOUND" }, { status: 404 });
  }
  if (match.status !== "ACTIVE") {
    return NextResponse.json({ error: "MATCH_NOT_ACTIVE" }, { status: 409 });
  }

  const participant = await prisma.matchParticipant.findFirst({
    where: {
      matchId: match.id,
      agentId: parsed.data.agentId,
    },
  });
  if (!participant) {
    return NextResponse.json({ error: "AGENT_NOT_IN_MATCH" }, { status: 403 });
  }

  const agent = await prisma.agentProfile.findUnique({
    where: { id: parsed.data.agentId },
  });
  if (!agent) {
    return NextResponse.json({ error: "AGENT_NOT_FOUND" }, { status: 404 });
  }

  const toolsEnabled = Array.isArray(agent.toolsEnabled)
    ? agent.toolsEnabled.map((tool) => String(tool))
    : [];

  const result = await getAgentMove(parsed.data.gameState, {
    strategyProfile: agent.strategyProfile,
    tier: agent.tier,
    toolsEnabled,
    customSystemPrompt: agent.customSystemPrompt ?? undefined,
    agentName: agent.name,
    house: agent.house,
  });

  let updatedMatch = null;
  let moveRecord = null;

  try {
    const txResult = await prisma.$transaction(async (tx) => {
      const matchInTx = await tx.match.findUnique({
        where: { id: match.id },
        include: { participants: true },
      });

      if (!matchInTx) throw new Error("MATCH_NOT_FOUND");
      if (matchInTx.status !== "ACTIVE") throw new Error("MATCH_NOT_ACTIVE");
      if (matchInTx.participants.length !== 2) throw new Error("MATCH_NOT_READY");

      const p1 = matchInTx.participants.find((p) => p.isCreator);
      const p2 = matchInTx.participants.find((p) => !p.isCreator);
      if (!p1 || !p2) throw new Error("INVALID_PARTICIPANTS");

      const round = matchInTx.currentRound;

      const existingMove = await tx.move.findFirst({
        where: {
          matchId: matchInTx.id,
          agentId: agent.id,
          round,
        },
        select: { id: true },
      });
      if (existingMove) throw new Error("MOVE_ALREADY_RECORDED");

      const createdMove = await tx.move.create({
        data: {
          matchId: matchInTx.id,
          agentId: agent.id,
          round,
          move: result.move,
          reasoning: result.reasoning,
        },
      });

      const roundMoves = await tx.move.findMany({
        where: {
          matchId: matchInTx.id,
          round,
        },
      });

      if (matchInTx.game === "RPS" && roundMoves.length >= 2) {
        const p1MoveRecord = roundMoves.find((m) => m.agentId === p1.agentId);
        const p2MoveRecord = roundMoves.find((m) => m.agentId === p2.agentId);
        if (!p1MoveRecord || !p2MoveRecord) {
          throw new Error("ROUND_MOVES_INCOMPLETE");
        }

        const p1Move = toRpsMove(p1MoveRecord.move);
        const p2Move = toRpsMove(p2MoveRecord.move);
        if (!p1Move || !p2Move) {
          throw new Error("INVALID_RPS_MOVE");
        }

        const outcome = resolveRPS(p1Move, p2Move);

        let p1Score = p1.score;
        let p2Score = p2.score;

        if (outcome === "P1_WIN") {
          p1Score += 1;
          await tx.matchParticipant.update({
            where: { id: p1.id },
            data: { score: { increment: 1 } },
          });
        } else if (outcome === "P2_WIN") {
          p2Score += 1;
          await tx.matchParticipant.update({
            where: { id: p2.id },
            data: { score: { increment: 1 } },
          });
        }

        const seriesWinner = checkSeriesWinner(p1Score, p2Score, matchInTx.series);

        if (seriesWinner) {
          const winner = seriesWinner === "P1" ? p1 : p2;
          const loser = seriesWinner === "P1" ? p2 : p1;

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
      }

      const refreshedMatch = await tx.match.findUnique({
        where: { id: matchInTx.id },
        include: MATCH_INCLUDE,
      });
      if (!refreshedMatch) throw new Error("MATCH_NOT_FOUND");

      return {
        createdMove,
        refreshedMatch,
      };
    });

    moveRecord = txResult.createdMove;
    updatedMatch = txResult.refreshedMatch;
  } catch (error) {
    const message = error instanceof Error ? error.message : "MOVE_RESOLUTION_FAILED";

    if (message === "MOVE_ALREADY_RECORDED") {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    if (
      message === "MATCH_NOT_FOUND" ||
      message === "MATCH_NOT_ACTIVE" ||
      message === "MATCH_NOT_READY" ||
      message === "INVALID_PARTICIPANTS" ||
      message === "ROUND_MOVES_INCOMPLETE" ||
      message === "INVALID_RPS_MOVE" ||
      message === "STAKE_NOT_LOCKED"
    ) {
      return NextResponse.json({ error: message }, { status: 409 });
    }

    throw error;
  }

  if (!updatedMatch || !moveRecord) {
    return NextResponse.json({ error: "MOVE_RESOLUTION_FAILED" }, { status: 500 });
  }

  const winnerParticipant =
    updatedMatch.winnerId == null
      ? null
      : updatedMatch.participants.find((p) => p.agentId === updatedMatch.winnerId) ?? null;

  return NextResponse.json({
    result,
    move: moveRecord,
    match: updatedMatch,
    winner: winnerParticipant ? { id: winnerParticipant.id, agent: winnerParticipant.agent } : null,
  });
}
