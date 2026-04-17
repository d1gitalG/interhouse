import type { Prisma } from "@prisma/client";
import { getAgentMove } from "./agent-engine";
import { applySeriesRoundOutcome, finalizeMatchWinner } from "./match-engine";
import { prisma } from "./prisma";
import { resolveRPS, type RpsMove } from "./rps-engine";
import {
  checkWinner as checkTttWinner,
  createEmptyBoard,
  getAvailableMoves as getTttAvailableMoves,
  type TttBoard,
  validateMove as validateTttMove,
} from "./ttt-engine";

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

export async function processMatchTick(matchId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: MATCH_INCLUDE,
  });

  if (!match) throw new Error("MATCH_NOT_FOUND");
  if (match.status !== "ACTIVE") throw new Error("MATCH_NOT_ACTIVE");
  if (match.participants.length !== 2) throw new Error("MATCH_NOT_READY");

  const p1 = match.participants.find((p) => p.isCreator) ?? match.participants[0];
  const p2 = match.participants.find((p) => p.id !== p1.id) ?? null;
  if (!p2) throw new Error("INVALID_PARTICIPANTS");

  const round = match.currentRound;
  const moveHistory = match.moves.map((move) => ({
    agentId: move.agentId,
    move: move.move,
    round: move.round,
  }));

  if (match.game === "RPS") {
    const MOVE_LIMIT = 5;
    const getAvailableRpsMoves = (agentId: string) => {
      const usage = { ROCK: 0, PAPER: 0, SCISSORS: 0 };
      match.moves.filter(m => m.agentId === agentId).forEach(m => {
        const move = m.move.toUpperCase();
        if (move in usage) usage[move as keyof typeof usage]++;
      });
      
      const available = ["ROCK", "PAPER", "SCISSORS"].filter(m => usage[m as keyof typeof usage] < MOVE_LIMIT);
      return { available, usage };
    };

    const p1Resources = getAvailableRpsMoves(p1.agentId);
    const p2Resources = getAvailableRpsMoves(p2.agentId);

    // If somehow both run out of all moves (shouldn't happen with 5x3=15 rounds), 
    // but good to have a safety. 
    if (p1Resources.available.length === 0 || p2Resources.available.length === 0) {
      return await prisma.$transaction(async (tx) => {
        await tx.match.update({
          where: { id: match.id },
          data: { status: 'CANCELLED' }
        });
        return { outcome: 'STALEMATE_EXHAUSTED', round };
      });
    }

    const [p1Result, p2Result] = await Promise.all([
      getAgentMove({ 
        game: "RPS", 
        round, 
        availableMoves: p1Resources.available, 
        moveHistory,
        resourceStatus: `Remaining: ${MOVE_LIMIT - p1Resources.usage.ROCK} Rock, ${MOVE_LIMIT - p1Resources.usage.PAPER} Paper, ${MOVE_LIMIT - p1Resources.usage.SCISSORS} Scissors`
      }, toAgentConfig(p1)),
      getAgentMove({ 
        game: "RPS", 
        round, 
        availableMoves: p2Resources.available, 
        moveHistory,
        resourceStatus: `Remaining: ${MOVE_LIMIT - p2Resources.usage.ROCK} Rock, ${MOVE_LIMIT - p2Resources.usage.PAPER} Paper, ${MOVE_LIMIT - p2Resources.usage.SCISSORS} Scissors`
      }, toAgentConfig(p2)),
    ]);

    const p1Move = toRpsMove(p1Result.move);
    const p2Move = toRpsMove(p2Result.move);
    
    // Strict enforcement: Ensure the move is in the allowed list
    if (p1Move && !p1Resources.available.includes(p1Move)) {
      throw new Error(`AGENT_P1_ATTEMPTED_EXHAUSTED_MOVE: ${p1Move}`);
    }
    if (p2Move && !p2Resources.available.includes(p2Move)) {
      throw new Error(`AGENT_P2_ATTEMPTED_EXHAUSTED_MOVE: ${p2Move}`);
    }

    if (!p1Move || !p2Move) throw new Error("INVALID_RPS_MOVE");

    return await prisma.$transaction(async (tx) => {
      const existingRoundMoves = await tx.move.findMany({
        where: { matchId: match.id, round },
        select: { id: true },
      });
      if (existingRoundMoves.length > 0) throw new Error("ROUND_ALREADY_PROCESSED");

      await tx.move.create({ data: { matchId: match.id, agentId: p1.agentId, round, move: p1Move, reasoning: p1Result.reasoning } });
      await tx.move.create({ data: { matchId: match.id, agentId: p2.agentId, round, move: p2Move, reasoning: p2Result.reasoning } });

      const roundOutcome = resolveRPS(p1Move, p2Move);
      await applySeriesRoundOutcome({
        tx,
        matchId: match.id,
        series: match.series,
        stakeMode: match.stakeMode,
        p1: p1,
        p2: p2,
        roundWinner: roundOutcome === "P1_WIN" ? "P1" : roundOutcome === "P2_WIN" ? "P2" : null,
      });

      return { outcome: roundOutcome, round };
    });
  } else if (match.game === "TTT") {
    const roundMoves = match.moves.filter((move) => move.round === round);
    const preTickBoard = buildTttBoardFromMoves(roundMoves.map((move) => ({ move: move.move })));
    if (!preTickBoard) throw new Error("INVALID_TTT_STATE");

    const isP1Turn = roundMoves.length % 2 === 0;
    const currentPlayer = isP1Turn ? p1 : p2;
    const availableMoves = getTttAvailableMoves(preTickBoard);

    if (availableMoves.length === 0) throw new Error("INVALID_TTT_STATE");

    const agentResult = await getAgentMove(
      { game: "TTT", round, board: preTickBoard, availableMoves: availableMoves.map((move) => serializeTttMove(move)), moveHistory },
      toAgentConfig(currentPlayer)
    );

    return await prisma.$transaction(async (tx) => {
      const parsedMove = parseTttMove(agentResult.move);
      if (!parsedMove || !validateTttMove(preTickBoard, parsedMove.row, parsedMove.col)) {
        const opponent = isP1Turn ? p2 : p1;
        await tx.matchParticipant.update({ where: { id: opponent.id }, data: { score: { increment: 1 } } });
        await finalizeMatchWinner({ tx, matchId: match.id, stakeMode: match.stakeMode, winnerAgentId: opponent.agentId, loserAgentId: currentPlayer.agentId });
        return { outcome: "TTT_FORFEIT", round };
      }

      await tx.move.create({ data: { matchId: match.id, agentId: currentPlayer.agentId, round, move: serializeTttMove(parsedMove), reasoning: agentResult.reasoning } });

      const mark = isP1Turn ? "X" : "O";
      preTickBoard[parsedMove.row][parsedMove.col] = mark;
      const boardResult = checkTttWinner(preTickBoard);

      if (boardResult === null) return { outcome: "TTT_ONGOING", round };
      if (boardResult === "DRAW") {
        await tx.match.update({ where: { id: match.id }, data: { currentRound: { increment: 1 } } });
        return { outcome: "TTT_DRAW", round };
      }

      const roundWinnerLabel: "P1" | "P2" = boardResult === "X" ? "P1" : "P2";
      await applySeriesRoundOutcome({ tx, matchId: match.id, series: match.series, stakeMode: match.stakeMode, p1, p2, roundWinner: roundWinnerLabel });
      return { outcome: roundWinnerLabel === "P1" ? "TTT_P1_WIN" : "TTT_P2_WIN", round };
    });
  }

  throw new Error("UNSUPPORTED_GAME");
}
