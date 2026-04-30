import { NextResponse } from "next/server";
import crypto from "crypto";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { ensureStarterCredits } from "@/lib/credits";
import { prisma } from "@/lib/prisma";

const HouseSchema = z.enum(["RED", "GREEN", "BLUE", "YELLOW"]);
const StrategySchema = z.enum(["AGGRESSIVE", "DEFENSIVE", "CHAOTIC", "CALCULATED", "ADAPTIVE"]);
const TierSchema = z.enum(["ROOKIE", "CONTENDER", "CHAMPION", "ELITE"]);
const ToolSchema = z.enum(["BOARD_ANALYZER", "WIN_PROBABILITY", "MOVE_HISTORY"]);

const CreateAgentSchema = z.object({
  name: z.string().min(1),
  house: HouseSchema,
  strategyProfile: StrategySchema,
  tier: TierSchema.optional(),
  customSystemPrompt: z.string().min(1).optional(),
  toolsEnabled: z.array(ToolSchema).optional(),
  nftMint: z.string().min(1).optional(),
});

export async function GET() {
  const agents = await prisma.agentProfile.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ agents });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = CreateAgentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_BODY", issues: parsed.error.issues }, { status: 400 });
  }

  const defaultUser = await prisma.user.upsert({
    where: { walletAddress: "default" },
    update: {},
    create: { walletAddress: "default" },
  });

  const agent = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const created = await tx.agentProfile.create({
      data: {
        name: parsed.data.name,
        house: parsed.data.house,
        strategyProfile: parsed.data.strategyProfile,
        tier: parsed.data.tier ?? "ROOKIE",
        customSystemPrompt: parsed.data.customSystemPrompt,
        nftMint: parsed.data.nftMint ?? crypto.randomUUID(),
        toolsEnabled: parsed.data.toolsEnabled ?? [],
        ownerId: defaultUser.id,
      },
    });

    await ensureStarterCredits({ agentId: created.id, tx });

    return tx.agentProfile.findUnique({
      where: { id: created.id },
    });
  });

  if (!agent) {
    return NextResponse.json({ error: "AGENT_CREATION_FAILED" }, { status: 500 });
  }

  return NextResponse.json({ agent }, { status: 201 });
}
