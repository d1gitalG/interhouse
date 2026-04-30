import type { GameType, Prisma, SeriesType } from "@prisma/client";

import { ensureStarterCredits, lockMatchStakeCredits } from "@/lib/credits";
import { prisma } from "@/lib/prisma";

type TournamentDb = Prisma.TransactionClient;

type CreateTournamentParams = {
  name: string;
  game?: GameType;
  series?: SeriesType;
  entryFeeCredits?: number;
  agentIds?: string[];
};

function assertPowerOfTwo(value: number) {
  return value >= 2 && (value & (value - 1)) === 0;
}

function finalRoundForEntrants(count: number) {
  return Math.log2(count);
}

export function tournamentInclude() {
  return {
    entries: { orderBy: { seed: "asc" as const }, include: { agent: true } },
    matches: {
      orderBy: [{ round: "asc" as const }, { slot: "asc" as const }],
      include: { match: { include: { participants: { include: { agent: true } }, moves: true } } },
    },
  };
}

export async function getTournament(tournamentId: string) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: tournamentInclude(),
  });
  if (!tournament) throw new Error("TOURNAMENT_NOT_FOUND");
  return tournament;
}

export async function createTournament(params: CreateTournamentParams) {
  const entryFeeCredits = params.entryFeeCredits ?? 0;
  if (entryFeeCredits < 0 || !Number.isInteger(entryFeeCredits)) throw new Error("INVALID_ENTRY_FEE");
  const agentIds = [...new Set(params.agentIds ?? [])];

  return prisma.$transaction(async (tx) => {
    const tournament = await tx.tournament.create({
      data: {
        name: params.name,
        game: params.game ?? "RPS",
        series: params.series ?? "BO3",
        entryFeeCredits,
      },
    });

    for (let index = 0; index < agentIds.length; index += 1) {
      const agentId = agentIds[index];
      await ensureStarterCredits({ agentId, tx });

      await tx.tournamentEntry.create({
        data: {
          tournamentId: tournament.id,
          agentId,
          seed: index + 1,
        },
      });

      if (entryFeeCredits > 0) {
        const paid = await tx.agentProfile.updateMany({
          where: { id: agentId, credits: { gte: entryFeeCredits } },
          data: { credits: { decrement: entryFeeCredits } },
        });
        if (paid.count !== 1) throw new Error("INSUFFICIENT_CREDITS");

        await tx.tournament.update({
          where: { id: tournament.id },
          data: { prizePoolCredits: { increment: entryFeeCredits } },
        });
      }
    }

    return tx.tournament.findUniqueOrThrow({ where: { id: tournament.id }, include: tournamentInclude() });
  });
}

async function createTournamentMatch(params: {
  tx: TournamentDb;
  tournamentId: string;
  game: GameType;
  series: SeriesType;
  round: number;
  slot: number;
  agentIds: string[];
  isCreatorFlags?: boolean[];
}) {
  const match = await params.tx.match.create({
    data: {
      game: params.game,
      series: params.series,
      stakeMode: "CREDITS",
      stakeAmount: 0,
      status: params.agentIds.length === 2 ? "ACTIVE" : "WAITING",
      participants: params.agentIds.length
        ? {
            create: params.agentIds.map((agentId, index) => ({
              agentId,
              isCreator: params.isCreatorFlags?.[index] ?? index === 0,
            })),
          }
        : undefined,
    },
  });

  const tournamentMatch = await params.tx.tournamentMatch.create({
    data: {
      tournamentId: params.tournamentId,
      matchId: match.id,
      round: params.round,
      slot: params.slot,
    },
  });

  if (params.agentIds.length === 2) {
    await lockMatchStakeCredits({ tx: params.tx, matchId: match.id });
  }

  return tournamentMatch;
}

export async function seedTournament(tournamentId: string) {
  return prisma.$transaction(async (tx) => {
    const tournament = await tx.tournament.findUnique({
      where: { id: tournamentId },
      include: { entries: { orderBy: { seed: "asc" } }, matches: true },
    });
    if (!tournament) throw new Error("TOURNAMENT_NOT_FOUND");
    if (tournament.status === "COMPLETED" || tournament.status === "CANCELLED") {
      throw new Error("TOURNAMENT_NOT_SEEDABLE");
    }
    if (tournament.matches.length > 0) {
      return tx.tournament.findUniqueOrThrow({ where: { id: tournament.id }, include: tournamentInclude() });
    }
    if (!assertPowerOfTwo(tournament.entries.length)) {
      throw new Error("TOURNAMENT_REQUIRES_POWER_OF_TWO_ENTRIES");
    }

    for (let index = 0; index < tournament.entries.length; index += 2) {
      await createTournamentMatch({
        tx,
        tournamentId: tournament.id,
        game: tournament.game,
        series: tournament.series,
        round: 1,
        slot: index / 2 + 1,
        agentIds: [tournament.entries[index].agentId, tournament.entries[index + 1].agentId],
      });
    }

    await tx.tournament.update({ where: { id: tournament.id }, data: { status: "ACTIVE" } });
    return tx.tournament.findUniqueOrThrow({ where: { id: tournament.id }, include: tournamentInclude() });
  });
}

export async function settleTournament(tournamentId: string) {
  return prisma.$transaction(async (tx) => {
    const tournament = await tx.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) throw new Error("TOURNAMENT_NOT_FOUND");
    if (!tournament.winnerAgentId) throw new Error("TOURNAMENT_WINNER_NOT_SET");
    if (tournament.settledAt) {
      return tx.tournament.findUniqueOrThrow({ where: { id: tournament.id }, include: tournamentInclude() });
    }

    const claim = await tx.tournament.updateMany({
      where: { id: tournament.id, settledAt: null, winnerAgentId: { not: null }, status: "COMPLETED" },
      data: { settledAt: new Date() },
    });

    if (claim.count === 1 && tournament.prizePoolCredits > 0) {
      await tx.agentProfile.update({
        where: { id: tournament.winnerAgentId },
        data: { credits: { increment: tournament.prizePoolCredits } },
      });
    }

    return tx.tournament.findUniqueOrThrow({ where: { id: tournament.id }, include: tournamentInclude() });
  });
}

export async function advanceTournamentFromMatch(matchId: string, expectedTournamentId?: string) {
  return prisma.$transaction(async (tx) => {
    const tournamentMatch = await tx.tournamentMatch.findUnique({
      where: { matchId },
      include: {
        tournament: { include: { entries: true } },
        match: { include: { participants: true } },
      },
    });
    if (!tournamentMatch) throw new Error("TOURNAMENT_MATCH_NOT_FOUND");
    if (expectedTournamentId && tournamentMatch.tournamentId !== expectedTournamentId) {
      throw new Error("TOURNAMENT_MATCH_NOT_FOUND");
    }
    if (tournamentMatch.match.status !== "COMPLETED" || !tournamentMatch.match.winnerId) {
      throw new Error("MATCH_NOT_COMPLETED");
    }

    const winnerAgentId = tournamentMatch.match.winnerId;
    if (!tournamentMatch.winnerAgentId) {
      await tx.tournamentMatch.update({
        where: { id: tournamentMatch.id },
        data: { winnerAgentId, advancedAt: new Date() },
      });
    }

    const loser = tournamentMatch.match.participants.find((participant) => participant.agentId !== winnerAgentId);
    if (loser) {
      await tx.tournamentEntry.updateMany({
        where: { tournamentId: tournamentMatch.tournamentId, agentId: loser.agentId, eliminatedAt: null },
        data: { eliminatedAt: new Date() },
      });
    }

    const finalRound = finalRoundForEntrants(tournamentMatch.tournament.entries.length);
    if (tournamentMatch.round >= finalRound) {
      await tx.tournament.update({
        where: { id: tournamentMatch.tournamentId },
        data: { status: "COMPLETED", winnerAgentId },
      });
    } else {
      const nextRound = tournamentMatch.round + 1;
      const nextSlot = Math.ceil(tournamentMatch.slot / 2);
      const isCreator = tournamentMatch.slot % 2 === 1;
      const existing = await tx.tournamentMatch.findUnique({
        where: { tournamentId_round_slot: { tournamentId: tournamentMatch.tournamentId, round: nextRound, slot: nextSlot } },
        include: { match: { include: { participants: true } } },
      });

      if (!existing) {
        await createTournamentMatch({
          tx,
          tournamentId: tournamentMatch.tournamentId,
          game: tournamentMatch.tournament.game,
          series: tournamentMatch.tournament.series,
          round: nextRound,
          slot: nextSlot,
          agentIds: [winnerAgentId],
          isCreatorFlags: [isCreator],
        });
      } else if (!existing.match.participants.some((participant) => participant.agentId === winnerAgentId)) {
        const participantCount = existing.match.participants.length;
        if (participantCount >= 2) throw new Error("NEXT_TOURNAMENT_MATCH_FULL");
        const activated = await tx.match.update({
          where: { id: existing.matchId },
          data: {
            status: "ACTIVE",
            participants: { create: { agentId: winnerAgentId, isCreator } },
          },
        });
        await lockMatchStakeCredits({ tx, matchId: activated.id });
      }
    }

    return tx.tournament.findUniqueOrThrow({ where: { id: tournamentMatch.tournamentId }, include: tournamentInclude() });
  }).then(async (tournament) => {
    if (tournament.status === "COMPLETED" && tournament.winnerAgentId && !tournament.settledAt) {
      return settleTournament(tournament.id);
    }
    return tournament;
  });
}
