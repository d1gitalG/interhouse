import { NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";

import { ensureStarterCredits } from "@/lib/credits";
import { prisma } from "@/lib/prisma";

const HouseSchema = z.enum(["RED", "GREEN", "BLUE", "YELLOW"]);
const StrategySchema = z.enum(["AGGRESSIVE", "DEFENSIVE", "CHAOTIC", "CALCULATED", "ADAPTIVE"]);

const CreateAgentSchema = z.object({
  name: z.string().min(1),
  house: HouseSchema,
  strategyProfile: StrategySchema,
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

  const agent = await prisma.$transaction(async (tx: any) => {
    const created = await tx.agentProfile.create({
      data: {
        name: parsed.data.name,
        house: parsed.data.house,
        strategyProfile: parsed.data.strategyProfile,
        nftMint: parsed.data.nftMint ?? crypto.randomUUID(),
        toolsEnabled: [],
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
