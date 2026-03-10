import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const STARTER_CREDITS_GRANT = 1000; // TODO: move to config/env.

export async function getCredits(agentId: string): Promise<number> {
  const agent = await prisma.agentProfile.findUnique({
    where: { id: agentId },
    select: { credits: true },
  });
  if (!agent) throw new Error("AGENT_NOT_FOUND");
  return agent.credits;
}

export async function ensureStarterCredits(params: {
  agentId: string;
  tx?: Prisma.TransactionClient;
}): Promise<boolean> {
  const db = params.tx ?? prisma;
  const granted = await db.agentProfile.updateMany({
    where: {
      id: params.agentId,
      starterGranted: false,
    },
    data: {
      starterGranted: true,
      credits: { increment: STARTER_CREDITS_GRANT },
    },
  });

  if (granted.count > 0) return true;

  const exists = await db.agentProfile.findUnique({
    where: { id: params.agentId },
    select: { id: true },
  });
  if (!exists) throw new Error("AGENT_NOT_FOUND");
  return false;
}

export async function assertAgentHasCredits(params: {
  agentId: string;
  minCredits: number;
  tx?: Prisma.TransactionClient;
}): Promise<void> {
  const db = params.tx ?? prisma;
  const agent = await db.agentProfile.findUnique({
    where: { id: params.agentId },
    select: { credits: true },
  });
  if (!agent) throw new Error("AGENT_NOT_FOUND");
  if (agent.credits < params.minCredits) throw new Error("INSUFFICIENT_CREDITS");
}

/**
 * Atomic credits adjustment for an agent.
 * amount: positive = credit, negative = debit.
 * Throws INSUFFICIENT_CREDITS if result would go negative and preventNegative=true.
 */
export async function applyCreditsDelta(params: {
  agentId: string;
  amount: number;
  preventNegative?: boolean;
}): Promise<{ newBalance: number }> {
  const { agentId, amount, preventNegative = true } = params;

  return prisma.$transaction(async (tx) => {
    const agent = await tx.agentProfile.findUnique({
      where: { id: agentId },
      select: { id: true, credits: true },
    });
    if (!agent) throw new Error("AGENT_NOT_FOUND");

    const next = agent.credits + amount;
    if (preventNegative && next < 0) {
      throw new Error("INSUFFICIENT_CREDITS");
    }

    const updated = await tx.agentProfile.update({
      where: { id: agentId },
      data: { credits: next },
      select: { credits: true },
    });

    return { newBalance: updated.credits };
  });
}

export async function lockMatchStakeCredits(params: {
  tx: Prisma.TransactionClient;
  matchId: string;
}): Promise<void> {
  const { tx, matchId } = params;
  const match = await tx.match.findUnique({
    where: { id: matchId },
    include: { participants: true },
  });
  if (!match) throw new Error("MATCH_NOT_FOUND");
  if (match.stakeMode !== "CREDITS") return;
  if (match.creditsLockedAt) return;
  if (match.status !== "ACTIVE") throw new Error("MATCH_NOT_ACTIVE");
  if (match.participants.length !== 2) throw new Error("MATCH_NOT_READY");

  const lockClaim = await tx.match.updateMany({
    where: {
      id: match.id,
      status: "ACTIVE",
      stakeMode: "CREDITS",
      creditsLockedAt: null,
    },
    data: {
      creditsLockedAt: new Date(),
    },
  });
  if (lockClaim.count !== 1) {
    const refreshed = await tx.match.findUnique({
      where: { id: match.id },
      select: { creditsLockedAt: true },
    });
    if (refreshed?.creditsLockedAt) return;
    throw new Error("STAKE_LOCK_CONFLICT");
  }

  for (const participant of match.participants) {
    await ensureStarterCredits({ agentId: participant.agentId, tx });
  }

  if (match.stakeAmount <= 0) return;

  for (const participant of match.participants) {
    const locked = await tx.agentProfile.updateMany({
      where: {
        id: participant.agentId,
        credits: { gte: match.stakeAmount },
      },
      data: {
        credits: { decrement: match.stakeAmount },
        lockedCredits: { increment: match.stakeAmount },
      },
    });

    if (locked.count !== 1) {
      throw new Error("INSUFFICIENT_CREDITS");
    }
  }
}

export async function settleLockedMatchStakeCredits(params: {
  tx: Prisma.TransactionClient;
  matchId: string;
  winnerAgentId: string;
  loserAgentId: string;
}): Promise<void> {
  const { tx, matchId, winnerAgentId, loserAgentId } = params;

  const match = await tx.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      stakeMode: true,
      stakeAmount: true,
      creditsLockedAt: true,
      creditsSettledAt: true,
    },
  });
  if (!match) throw new Error("MATCH_NOT_FOUND");
  if (match.stakeMode !== "CREDITS") return;
  if (match.creditsSettledAt) return;
  if (!match.creditsLockedAt) throw new Error("STAKE_NOT_LOCKED");

  const settleClaim = await tx.match.updateMany({
    where: {
      id: match.id,
      stakeMode: "CREDITS",
      creditsLockedAt: { not: null },
      creditsSettledAt: null,
    },
    data: {
      creditsSettledAt: new Date(),
    },
  });
  if (settleClaim.count !== 1) return;

  if (match.stakeAmount <= 0) return;

  const loserUnlock = await tx.agentProfile.updateMany({
    where: {
      id: loserAgentId,
      lockedCredits: { gte: match.stakeAmount },
    },
    data: {
      lockedCredits: { decrement: match.stakeAmount },
    },
  });
  if (loserUnlock.count !== 1) throw new Error("STAKE_LOCK_CORRUPT");

  const winnerSettle = await tx.agentProfile.updateMany({
    where: {
      id: winnerAgentId,
      lockedCredits: { gte: match.stakeAmount },
    },
    data: {
      lockedCredits: { decrement: match.stakeAmount },
      credits: { increment: match.stakeAmount * 2 },
    },
  });
  if (winnerSettle.count !== 1) throw new Error("STAKE_LOCK_CORRUPT");
}
