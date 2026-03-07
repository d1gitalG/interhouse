import { NextResponse } from "next/server";
import { z } from "zod";

import { assertAgentHasCredits, ensureStarterCredits, lockMatchStakeCredits } from "@/lib/credits";
import { prisma } from "@/lib/prisma";

const GameSchema = z.enum(["RPS", "TTT", "C4", "CHESS", "CHECKERS"]);
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

export async function GET() {
  const matches = await prisma.match.findMany({
    include: {
      participants: { include: { agent: true } },
      moves: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ matches });
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
