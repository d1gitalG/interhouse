import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

import {
  MAX_AGENT_SLOTS,
  SLOT_UNLOCK_CREDITS_COST,
  winsRequiredForNextSlot,
} from "@/lib/agent-slots";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const UnlockSlotSchema = z.discriminatedUnion("method", [
  z.object({ method: z.literal("WINS") }),
  z.object({ method: z.literal("CREDITS"), agentId: z.string().min(1) }),
]);

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = UnlockSlotSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_BODY", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const user = await requireUser(req, tx);

      if (user.agentSlots >= MAX_AGENT_SLOTS) {
        throw new Error("AGENT_SLOTS_MAX_REACHED");
      }

      if (parsed.data.method === "WINS") {
        const wins = await tx.agentProfile.aggregate({
          where: { ownerId: user.id },
          _sum: { wins: true },
        });
        const totalWins = wins._sum.wins ?? 0;

        if (totalWins < winsRequiredForNextSlot(user.agentSlots)) {
          throw new Error("SLOT_UNLOCK_REQUIREMENTS_NOT_MET");
        }
      } else {
        const agent = await tx.agentProfile.findFirst({
          where: { id: parsed.data.agentId, ownerId: user.id },
          select: { id: true, credits: true },
        });
        if (!agent) throw new Error("AGENT_NOT_FOUND");
        if (agent.credits < SLOT_UNLOCK_CREDITS_COST) throw new Error("INSUFFICIENT_CREDITS");

        await tx.agentProfile.update({
          where: { id: agent.id },
          data: { credits: { decrement: SLOT_UNLOCK_CREDITS_COST } },
          select: { id: true },
        });
      }

      const incremented = await tx.user.updateMany({
        where: { id: user.id, agentSlots: { lt: MAX_AGENT_SLOTS } },
        data: { agentSlots: { increment: 1 } },
      });
      if (incremented.count !== 1) {
        throw new Error("AGENT_SLOTS_MAX_REACHED");
      }

      const updated = await tx.user.findUnique({
        where: { id: user.id },
        select: { agentSlots: true },
      });
      if (!updated) throw new Error("UNAUTHENTICATED");

      return updated;
    });

    return NextResponse.json({ agentSlots: result.agentSlots });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AGENT_SLOT_UNLOCK_FAILED";
    if (message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    if (message === "AGENT_NOT_FOUND") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (
      message === "AGENT_SLOTS_MAX_REACHED" ||
      message === "SLOT_UNLOCK_REQUIREMENTS_NOT_MET" ||
      message === "INSUFFICIENT_CREDITS"
    ) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    throw error;
  }
}
