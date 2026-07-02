import { createHash, randomBytes } from "node:crypto";

import type { GameType, Prisma, SeriesType, TournamentSeedMethod } from "@prisma/client";

import { ensureStarterCredits, lockMatchStakeCredits } from "@/lib/credits";
import { prisma } from "@/lib/prisma";
import {
  checkTournamentEligibility,
  DEFAULT_TOURNAMENT_ENTRY_CAP,
  type TournamentEntryCap,
} from "@/lib/tournament-eligibility";

type TournamentDb = Prisma.TransactionClient;

type CreateTournamentParams = {
  name: string;
  game?: GameType;
  series?: SeriesType;
  entryFeeCredits?: number;
  seedMethod?: TournamentSeedMethod;
  agentIds?: string[];
  maxEntries?: TournamentEntryCap;
};

type TournamentEntryForSeeding = {
  id: string;
  tournamentId: string;
  agentId: string;
  seed: number | null;
  createdAt: Date;
};

function assertPowerOfTwo(value: number) {
  return value >= 2 && (value & (value - 1)) === 0;
}

function finalRoundForEntrants(count: number) {
  return Math.log2(count);
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function newSeedReveal() {
  return randomBytes(32).toString("hex");
}

function stableSeedBasis(entries: TournamentEntryForSeeding[]) {
  return entries
    .map((entry) => ({ entryId: entry.id, agentId: entry.agentId, originalSeed: entry.seed, enteredAt: entry.createdAt.toISOString() }))
    .sort((a, b) => (a.originalSeed ?? 0) - (b.originalSeed ?? 0) || a.agentId.localeCompare(b.agentId));
}

function deriveCommitRevealOrder(params: { tournamentId: string; seedReveal: string; entries: TournamentEntryForSeeding[] }) {
  return stableSeedBasis(params.entries)
    .map((entry) => ({
      ...entry,
      drawHash: sha256(
        `${params.tournamentId}:${params.seedReveal}:${entry.entryId}:${entry.agentId}:${entry.originalSeed ?? "unseeded"}:${entry.enteredAt}`,
      ),
    }))
    .sort((a, b) => a.drawHash.localeCompare(b.drawHash) || a.agentId.localeCompare(b.agentId))
    .map((entry, index) => ({ ...entry, derivedSeed: index + 1 }));
}

function buildSeedDerivation(params: {
  tournamentId: string;
  seedMethod: TournamentSeedMethod;
  seedCommitment: string | null;
  seedReveal: string | null;
  entries: TournamentEntryForSeeding[];
}) {
  if (params.seedMethod !== "COMMIT_REVEAL" || !params.seedReveal) {
    return JSON.stringify({
      version: "interhouse-seeding-v1",
      method: "OPERATOR_ENTRY_ORDER",
      algorithm: "entries paired by ascending stored seed (#1 vs #2, #3 vs #4, etc.)",
      seedOrderHash: sha256(JSON.stringify(stableSeedBasis(params.entries))),
    });
  }

  const order = deriveCommitRevealOrder({ tournamentId: params.tournamentId, seedReveal: params.seedReveal, entries: params.entries });
  return JSON.stringify({
    version: "interhouse-seeding-v1",
    method: "COMMIT_REVEAL",
    algorithm: "sha256(tournamentId:seedReveal:entryId:agentId:originalSeed:enteredAt), sorted ascending by drawHash",
    seedCommitment: params.seedCommitment,
    seedRevealHash: sha256(params.seedReveal),
    revealMatchesCommitment: params.seedCommitment ? sha256(params.seedReveal) === params.seedCommitment : null,
    entryMetadata: stableSeedBasis(params.entries),
    originalOrderHash: sha256(JSON.stringify(stableSeedBasis(params.entries))),
    derivedOrderHash: sha256(JSON.stringify(order.map((entry) => ({ agentId: entry.agentId, entryId: entry.entryId, derivedSeed: entry.derivedSeed, drawHash: entry.drawHash })))),
    derivedOrder: order.map((entry) => ({ agentId: entry.agentId, entryId: entry.entryId, originalSeed: entry.originalSeed, enteredAt: entry.enteredAt, derivedSeed: entry.derivedSeed, drawHash: entry.drawHash })),
  });
}

export function redactUnpublishedSeedReveal<T extends { seededAt: Date | null; seedReveal: string | null }>(tournament: T) {
  return {
    ...tournament,
    seedReveal: tournament.seededAt ? tournament.seedReveal : null,
  };
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
  const agentIds = params.agentIds ?? [];
  const seedMethod = params.seedMethod ?? "OPERATOR_ENTRY_ORDER";
  const seedReveal = seedMethod === "COMMIT_REVEAL" ? newSeedReveal() : null;
  const seedCommitment = seedReveal ? sha256(seedReveal) : null;
  const maxEntries = params.maxEntries ?? DEFAULT_TOURNAMENT_ENTRY_CAP;

  return prisma.$transaction(async (tx) => {
    const existingAgents = agentIds.length
      ? await tx.agentProfile.findMany({
          where: { id: { in: agentIds } },
          select: { id: true, wins: true, losses: true },
        })
      : [];
    const eligibility = checkTournamentEligibility({
      agentIds,
      entryFeeCredits,
      existingAgents,
      config: { maxEntries },
    });
    if (!eligibility.allowed) throw new Error(eligibility.reason);

    const tournament = await tx.tournament.create({
      data: {
        name: params.name,
        game: params.game ?? "RPS",
        series: params.series ?? "BO3",
        seedMethod,
        seedCommitment,
        seedReveal,
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

    let orderedEntries = tournament.entries;
    const seedDerivation = buildSeedDerivation({
      tournamentId: tournament.id,
      seedMethod: tournament.seedMethod,
      seedCommitment: tournament.seedCommitment,
      seedReveal: tournament.seedReveal,
      entries: tournament.entries,
    });

    if (tournament.seedMethod === "COMMIT_REVEAL") {
      if (!tournament.seedReveal || !tournament.seedCommitment) throw new Error("TOURNAMENT_SEED_COMMITMENT_MISSING");
      const derivedOrder = deriveCommitRevealOrder({ tournamentId: tournament.id, seedReveal: tournament.seedReveal, entries: tournament.entries });
      await tx.tournamentEntry.updateMany({ where: { tournamentId: tournament.id }, data: { seed: null } });
      for (const entry of derivedOrder) {
        await tx.tournamentEntry.update({ where: { id: entry.entryId }, data: { seed: entry.derivedSeed } });
      }
      orderedEntries = [...tournament.entries].sort((a, b) => {
        const aOrder = derivedOrder.find((entry) => entry.entryId === a.id)?.derivedSeed ?? Number.MAX_SAFE_INTEGER;
        const bOrder = derivedOrder.find((entry) => entry.entryId === b.id)?.derivedSeed ?? Number.MAX_SAFE_INTEGER;
        return aOrder - bOrder;
      });
    }

    for (let index = 0; index < orderedEntries.length; index += 2) {
      await createTournamentMatch({
        tx,
        tournamentId: tournament.id,
        game: tournament.game,
        series: tournament.series,
        round: 1,
        slot: index / 2 + 1,
        agentIds: [orderedEntries[index].agentId, orderedEntries[index + 1].agentId],
      });
    }

    await tx.tournament.update({ where: { id: tournament.id }, data: { status: "ACTIVE", seedDerivation, seededAt: new Date() } });
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
