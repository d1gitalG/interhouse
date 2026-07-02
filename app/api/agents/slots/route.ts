import { NextResponse } from "next/server";

import {
  MAX_AGENT_SLOTS,
  SLOT_UNLOCK_CREDITS_COST,
  winsRequiredForNextSlot,
} from "@/lib/agent-slots";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const agentsUsed = await prisma.agentProfile.count({ where: { ownerId: user.id } });

    return NextResponse.json({
      agentSlots: user.agentSlots,
      agentsUsed,
      maxSlots: MAX_AGENT_SLOTS,
      winsRequiredForNextSlot: winsRequiredForNextSlot(user.agentSlots),
      creditsCost: SLOT_UNLOCK_CREDITS_COST,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AGENT_SLOTS_FAILED";
    if (message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    throw error;
  }
}
