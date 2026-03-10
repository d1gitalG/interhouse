import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { getAgentMove } from "@/lib/agent-engine";
import { settleLockedMatchStakeCredits } from "@/lib/credits";
import { prisma } from "@/lib/prisma";
import { checkSeriesWinner, resolveRPS, type RpsMove } from "@/lib/rps-engine";
import {
  checkWinner as checkTttWinner,
  createEmptyBoard,
  getAvailableMoves as getTttAvailableMoves,
  type TttBoard,
  validateMove as validateTttMove,
} from "@/lib/ttt-engine";

const MATCH_INCLUDE = {
  participants: { include: { agent: true } },
  moves: { orderBy: { createdAt: "asc" as const } },
} as const;

type MatchWithRelations = Prisma.MatchGetPayload<{
  include: typeof MATCH_INCLUDE;
}>;

type TickOutcome =
  | ReturnType<typeof resolveRPS>
  | "TTT_ONGOING"
  | "TTT_P1_WIN"
  | "TTT_P2_WIN"
  | "TTT_DRAW"
  | "TTT_FORFEIT";

function toRpsMove(rawMove: string): RpsMove | null {
  const normalized = rawMove.toUpperCase();
  if (normalized === "ROCK" || normalized === "PAPER" || normalized === "SCISSORS") {
    return normalized;
  }
  return null;
}

function parseTttMove(rawMove: string): { row: number; col: number } | null {
  const match = rawMove.trim().match(/^(\d)\s*,\s*(\d)$/);
  if (!match) return null;

  const row = Number(match[1]);
  const col = Number(match[2]);
  if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
  if (row < 0 || row > 2 || col < 0 || col > 2) return null;

  return { row, col };
}

function serializeTttMove(move: { row: number; col: number }): string {
  return `${move.row},${move.col}`;
}

function buildTttBoardFromMoves(roundMoves: Array<{ move: string }>): TttBoard | null {
  const board = createEmptyBoard();
  for (let index = 0; index < roundMoves.length; index += 1) {
    const parsed = parseTttMove(roundMoves[index]?.move ?? "");
    if (!parsed) return null;
    if (!validateTttMove(board, parsed.row, parsed.col)) return null;

    const mark = index % 2 === 0 ? "X" : "O";
    board[parsed.row][parsed.col] = mark;
  }

  return board;
}

function toAgentConfig(participant: MatchWithRelations["participants"][number]) {
  return {
    strategyProfile: participant.agent.strategyProfile,
    tier: participant.agent.tier,
    toolsEnabled: Array.isArray(participant.agent.toolsEnabled)
      ? participant.agent.toolsEnabled.map((tool) => String(tool))
      : [],
    customSystemPrompt: participant.agent.customSystemPrompt ?? undefined,
    agentName: participant.agent.name,
    house: participant.agent.house,
  } as const;
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
  if (match.game !== "RPS" && match.game !== "TTT") {
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

  if (match.game === "RPS") {
    const [p1Result, p2Result] = await Promise.all([
      getAgentMove(
        {
          game: "RPS",
          round,
          availableMoves: ["ROCK", "PAPER", "SCISSORS"],
          moveHistory,
        },
        toAgentConfig(p1)
      ),
      getAgentMove(
        {
          game: "RPS",
          round,
          availableMoves: ["ROCK", "PAPER", "SCISSORS"],
          moveHistory,
        },
        toAgentConfig(p2)
      ),
    ]);

    const p1Move = toRpsMove(p1Result.move);
    const p2Move = toRpsMove(p2Result.move);
    if (!p1Move || !p2Move) {
      return NextResponse.json({ error: "INVALID_RPS_MOVE" }, { status: 409 });
    }

    let updatedMatch: MatchWithRelations | null = null;
    let outcome: TickOutcome = "DRAW";

    try {
      const txResult = await prisma.$transaction(async (tx) => {
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

  const roundMoves = match.moves.filter((move) => move.round === round);
  const preTickBoard = buildTttBoardFromMoves(roundMoves.map((move) => ({ move: move.move })));
  if (!preTickBoard) {
    return NextResponse.json({ error: "INVALID_TTT_STATE" }, { status: 409 });
  }

  const isP1Turn = roundMoves.length % 2 === 0;
  const currentPlayer = isP1Turn ? p1 : p2;
  const availableMoves = getTttAvailableMoves(preTickBoard);

  if (availableMoves.length === 0) {
    return NextResponse.json({ error: "INVALID_TTT_STATE" }, { status: 409 });
  }

  const agentResult = await getAgentMove(
    {
      game: "TTT",
      round,
      board: preTickBoard,
      availableMoves: availableMoves.map((move) => serializeTttMove(move)),
      moveHistory,
    },
    toAgentConfig(currentPlayer)
  );

  let updatedMatch: MatchWithRelations | null = null;
  let resolvedMove: { row: number; col: number } | null = null;
  let currentPlayerLabel: "P1" | "P2" = isP1Turn ? "P1" : "P2";
  let boardAfterMove: TttBoard = preTickBoard;
  let boardWinner: ReturnType<typeof checkTttWinner> = null;

  try {
    const txResult = await prisma.$transaction(async (tx) => {
      await tx.match.update({
        where: { id: match.id },
        data: { currentRound: { increment: 0 } },
      });

      const matchInTx = await tx.match.findUnique({
        where: { id: match.id },
        include: {
          participants: true,
          moves: { orderBy: { createdAt: "asc" } },
        },
      });
      if (!matchInTx) throw new Error("MATCH_NOT_FOUND");
      if (matchInTx.status !== "ACTIVE") throw new Error("MATCH_NOT_ACTIVE");
      if (matchInTx.game !== "TTT") throw new Error("UNSUPPORTED_GAME");
      if (matchInTx.participants.length !== 2) throw new Error("MATCH_NOT_READY");
      if (matchInTx.currentRound !== round) throw new Error("ROUND_ADVANCED");

      const p1InTx = matchInTx.participants.find((participant) => participant.isCreator) ?? matchInTx.participants[0];
      const p2InTx = matchInTx.participants.find((participant) => participant.id !== p1InTx.id) ?? null;
      if (!p2InTx) throw new Error("INVALID_PARTICIPANTS");

      const txRoundMoves = matchInTx.moves.filter((move) => move.round === round);
      const txBoard = buildTttBoardFromMoves(txRoundMoves.map((move) => ({ move: move.move })));
      if (!txBoard) throw new Error("INVALID_TTT_STATE");

      const p1Turn = txRoundMoves.length % 2 === 0;
      const txCurrentPlayerLabel: "P1" | "P2" = p1Turn ? "P1" : "P2";
      const mover = p1Turn ? p1InTx : p2InTx;
      const opponent = p1Turn ? p2InTx : p1InTx;

      const parsedMove = parseTttMove(agentResult.move);
      if (!parsedMove || !validateTttMove(txBoard, parsedMove.row, parsedMove.col)) {
        await tx.matchParticipant.update({
          where: { id: opponent.id },
          data: { score: { increment: 1 } },
        });

        await tx.match.update({
          where: { id: matchInTx.id },
          data: {
            status: "COMPLETED",
            winnerId: opponent.agentId,
          },
        });

        await tx.agentProfile.update({
          where: { id: opponent.agentId },
          data: { wins: { increment: 1 } },
        });
        await tx.agentProfile.update({
          where: { id: mover.agentId },
          data: { losses: { increment: 1 } },
        });

        if (matchInTx.stakeMode === "CREDITS") {
          await settleLockedMatchStakeCredits({
            tx,
            matchId: matchInTx.id,
            winnerAgentId: opponent.agentId,
            loserAgentId: mover.agentId,
          });
        }

        const refreshedMatch = await tx.match.findUnique({
          where: { id: matchInTx.id },
          include: MATCH_INCLUDE,
        });
        if (!refreshedMatch) throw new Error("MATCH_NOT_FOUND");

        return {
          refreshedMatch,
          outcome: "TTT_FORFEIT" as TickOutcome,
          currentPlayer: txCurrentPlayerLabel,
          move: null as { row: number; col: number } | null,
          board: txBoard,
          boardWinner: p1Turn ? ("O" as const) : ("X" as const),
        };
      }

      await tx.move.create({
        data: {
          matchId: matchInTx.id,
          agentId: mover.agentId,
          round,
          move: serializeTttMove(parsedMove),
          reasoning: agentResult.reasoning,
        },
      });

      const mark = p1Turn ? "X" : "O";
      txBoard[parsedMove.row][parsedMove.col] = mark;

      const boardResult = checkTttWinner(txBoard);
      if (boardResult === null) {
        const refreshedMatch = await tx.match.findUnique({
          where: { id: matchInTx.id },
          include: MATCH_INCLUDE,
        });
        if (!refreshedMatch) throw new Error("MATCH_NOT_FOUND");

        return {
          refreshedMatch,
          outcome: "TTT_ONGOING" as TickOutcome,
          currentPlayer: txCurrentPlayerLabel,
          move: parsedMove,
          board: txBoard,
          boardWinner: boardResult,
        };
      }

      if (boardResult === "DRAW") {
        await tx.match.update({
          where: { id: matchInTx.id },
          data: { currentRound: { increment: 1 } },
        });

        const refreshedMatch = await tx.match.findUnique({
          where: { id: matchInTx.id },
          include: MATCH_INCLUDE,
        });
        if (!refreshedMatch) throw new Error("MATCH_NOT_FOUND");

        return {
          refreshedMatch,
          outcome: "TTT_DRAW" as TickOutcome,
          currentPlayer: txCurrentPlayerLabel,
          move: parsedMove,
          board: txBoard,
          boardWinner: boardResult,
        };
      }

      const roundWinner = boardResult === "X" ? p1InTx : p2InTx;
      const roundWinnerLabel: "P1" | "P2" = boardResult === "X" ? "P1" : "P2";

      await tx.matchParticipant.update({
        where: { id: roundWinner.id },
        data: { score: { increment: 1 } },
      });

      const p1Score = p1InTx.score + (roundWinnerLabel === "P1" ? 1 : 0);
      const p2Score = p2InTx.score + (roundWinnerLabel === "P2" ? 1 : 0);
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
        outcome: roundWinnerLabel === "P1" ? ("TTT_P1_WIN" as TickOutcome) : ("TTT_P2_WIN" as TickOutcome),
        currentPlayer: txCurrentPlayerLabel,
        move: parsedMove,
        board: txBoard,
        boardWinner: boardResult,
      };
    });

    updatedMatch = txResult.refreshedMatch;
    currentPlayerLabel = txResult.currentPlayer;
    resolvedMove = txResult.move;
    boardAfterMove = txResult.board;
    boardWinner = txResult.boardWinner;
  } catch (error) {
    const message = error instanceof Error ? error.message : "TICK_FAILED";
    if (
      message === "MATCH_NOT_FOUND" ||
      message === "MATCH_NOT_ACTIVE" ||
      message === "MATCH_NOT_READY" ||
      message === "INVALID_PARTICIPANTS" ||
      message === "ROUND_ADVANCED" ||
      message === "UNSUPPORTED_GAME" ||
      message === "STAKE_NOT_LOCKED" ||
      message === "INVALID_TTT_STATE"
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
    currentPlayer: currentPlayerLabel,
    move: resolvedMove ? serializeTttMove(resolvedMove) : agentResult.move,
    board: boardAfterMove,
    boardWinner,
    match: updatedMatch,
    winner: winnerParticipant ? { id: winnerParticipant.id, agent: winnerParticipant.agent } : null,
  });
}
