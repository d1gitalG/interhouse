import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { assertAgentHasCredits, ensureStarterCredits, lockMatchStakeCredits } from "@/lib/credits";
import { prisma } from "@/lib/prisma";

const GameSchema = z.enum(["RPS", "TTT", "C4", "CHESS", "CHECKERS"]);
const MatchStatusSchema = z.enum(["WAITING", "ACTIVE", "COMPLETED", "CANCELLED"]);
const HouseSchema = z.enum(["RED", "GREEN", "BLUE", "YELLOW"]);
const StakeModeSchema = z.enum(["CREDITS", "SOL"]);
const SeriesSchema = z.enum(["QUICK", "BO3", "BO5"]);

const CreateMatchSchema = z.object({
  game: GameSchema,
  stakeMode: StakeModeSchema,
  stakeAmount: z.number().int().nonnegative(),
  series: SeriesSchema,
  creatorAgentId: z.string().optional(),
  opponentAgentId: z.string().optional(),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const game = searchParams.get("game");
  const status = searchParams.get("status");
  const agentId = searchParams.get("agentId");
  const house = searchParams.get("house");
  const sort = searchParams.get("sort");

  const filters: Prisma.MatchWhereInput[] = [];
  const parsedGame = GameSchema.safeParse(game);
  const parsedStatus = MatchStatusSchema.safeParse(status);
  const parsedHouse = HouseSchema.safeParse(house);

  if (parsedGame.success) filters.push({ game: parsedGame.data });
  if (parsedStatus.success) filters.push({ status: parsedStatus.data });
  if (agentId) {
    filters.push({ participants: { some: { agentId } } });
  }
  if (parsedHouse.success) {
    filters.push({ participants: { some: { agent: { house: parsedHouse.data } } } });
  }

  const where: Prisma.MatchWhereInput = filters.length ? { AND: filters } : {};

  const sortMode =
    sort === "oldest" || sort === "credits_won" || sort === "series_type" || sort === "newest" ? sort : "newest";

  const matches = await prisma.match.findMany({
    where,
    include: {
      participants: { include: { agent: true } },
      moves: true,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const seriesRank: Record<"QUICK" | "BO3" | "BO5", number> = {
    QUICK: 0,
    BO3: 1,
    BO5: 2,
  };

  const creditsWon = (match: { status: string; stakeMode: string; stakeAmount: number }) =>
    match.status === "COMPLETED" && match.stakeMode === "CREDITS" ? match.stakeAmount * 2 : 0;

  const sortedMatches = [...matches].sort((a, b) => {
    switch (sortMode) {
      case "oldest":
        return (a.createdAt?.toISOString() ?? "").localeCompare(b.createdAt?.toISOString() ?? "");
      case "credits_won": {
        const delta = creditsWon(b) - creditsWon(a);
        if (delta !== 0) return delta;
        return (b.createdAt?.toISOString() ?? "").localeCompare(a.createdAt?.toISOString() ?? "");
      }
      case "series_type": {
        const delta = seriesRank[a.series] - seriesRank[b.series];
        if (delta !== 0) return delta;
        return (b.createdAt?.toISOString() ?? "").localeCompare(a.createdAt?.toISOString() ?? "");
      }
      case "newest":
      default:
        return (b.createdAt?.toISOString() ?? "").localeCompare(a.createdAt?.toISOString() ?? "");
    }
  });

  return NextResponse.json({ matches: sortedMatches.slice(0, 50) });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = CreateMatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_BODY", issues: parsed.error.issues }, { status: 400 });
  }

  const { creatorAgentId, opponentAgentId, ...data } = parsed.data;
  const participants: Array<{ agentId: string; isCreator: boolean }> = [];

  if (creatorAgentId) {
    participants.push({ agentId: creatorAgentId, isCreator: true });
  }
  if (opponentAgentId) {
    participants.push({ agentId: opponentAgentId, isCreator: false });
  }

  let match = null;
  try {
    match = await prisma.$transaction(async (tx) => {
      if (data.stakeMode === "CREDITS" && data.stakeAmount > 0) {
        for (const participant of participants) {
          await ensureStarterCredits({ agentId: participant.agentId, tx });
        }

        if (participants.length < 2) {
          const creator = participants.find((participant) => participant.isCreator);
          if (creator) {
            await assertAgentHasCredits({
              agentId: creator.agentId,
              minCredits: data.stakeAmount,
              tx,
            });
          }
        }
      }

      const created = await tx.match.create({
        data: {
          ...data,
          status: participants.length === 2 ? "ACTIVE" : "WAITING",
          solEscrowAddress: data.stakeMode === "SOL" ? `mock-escrow-${Math.random().toString(36).substring(7)}` : null,
          participants: participants.length
            ? {
                create: participants,
              }
            : undefined,
        },
        include: {
          participants: { include: { agent: true } },
        },
      });

      if (created.status === "ACTIVE" && created.stakeMode === "CREDITS") {
        await lockMatchStakeCredits({
          tx,
          matchId: created.id,
        });
      }

      return tx.match.findUnique({
        where: { id: created.id },
        include: {
          participants: { include: { agent: true } },
        },
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "MATCH_CREATE_FAILED";
    if (message === "AGENT_NOT_FOUND") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message === "INSUFFICIENT_CREDITS") {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    if (message === "STAKE_LOCK_CONFLICT") {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    throw error;
  }

  if (!match) {
    return NextResponse.json({ error: "MATCH_CREATE_FAILED" }, { status: 500 });
  }

  return NextResponse.json({ match }, { status: 201 });
}
