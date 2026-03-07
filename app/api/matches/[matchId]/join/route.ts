import { NextResponse } from "next/server";
import { z } from "zod";
import { lockMatchStakeCredits } from "@/lib/credits";
import { prisma } from "@/lib/prisma";

const JoinBodySchema = z.object({
  opponentAgentId: z.string().min(1),
});

export async function POST(req: Request, ctx: { params: Promise<{ matchId: string }> }) {
  const params = await ctx.params;
  const matchId = params.matchId;

  const body = await req.json().catch(() => null);
  const parsed = JoinBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_BODY", issues: parsed.error.issues }, { status: 400 });
  }

  const { opponentAgentId } = parsed.data;

  let updated = null;
  try {
    updated = await prisma.$transaction(async (tx) => {
      // Serialize concurrent join attempts on this match.
      await tx.match.updateMany({
        where: { id: matchId },
        data: { currentRound: { increment: 0 } },
      });

      const match = await tx.match.findUnique({
        where: { id: matchId },
        include: { participants: true },
      });

      if (!match) throw new Error("MATCH_NOT_FOUND");
      if (match.status !== "WAITING") throw new Error("MATCH_NOT_WAITING");
      if (match.participants.length >= 2) throw new Error("MATCH_FULL");

      const alreadyIn = match.participants.some((p) => p.agentId === opponentAgentId);
      if (alreadyIn) throw new Error("AGENT_ALREADY_IN_MATCH");

      const agent = await tx.agentProfile.findUnique({ where: { id: opponentAgentId }, select: { id: true } });
      if (!agent) throw new Error("AGENT_NOT_FOUND");

      const activated = await tx.match.update({
        where: { id: matchId },
        data: {
          status: "ACTIVE",
          participants: {
            create: { agentId: opponentAgentId, isCreator: false },
          },
        },
      });

      if (activated.stakeMode === "CREDITS") {
        await lockMatchStakeCredits({
          tx,
          matchId: activated.id,
        });
      }

      return tx.match.findUnique({
        where: { id: activated.id },
        include: {
          participants: { include: { agent: true } },
        },
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "JOIN_FAILED";
    if (message === "MATCH_NOT_FOUND" || message === "AGENT_NOT_FOUND") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (
      message === "MATCH_NOT_WAITING" ||
      message === "MATCH_FULL" ||
      message === "AGENT_ALREADY_IN_MATCH" ||
      message === "INSUFFICIENT_CREDITS" ||
      message === "MATCH_NOT_ACTIVE" ||
      message === "MATCH_NOT_READY" ||
      message === "STAKE_LOCK_CONFLICT"
    ) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    throw error;
  }

  if (!updated) {
    return NextResponse.json({ error: "JOIN_FAILED" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, match: updated });
}
