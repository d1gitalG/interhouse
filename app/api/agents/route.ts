import { NextResponse } from "next/server";
import crypto from "crypto";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { validateDirective } from "@/lib/agent-slots";
import { requireUser } from "@/lib/auth";
import { ensureStarterCredits } from "@/lib/credits";
import { hasValidInternalSecret } from "@/lib/internal-auth";
import { prisma } from "@/lib/prisma";
import { publicAgentSelect } from "@/lib/public-agent";

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
    select: publicAgentSelect,
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

  if (!hasValidInternalSecret(req)) {
    if (parsed.data.tier && parsed.data.tier !== "ROOKIE") {
      return NextResponse.json({ error: "TIER_NOT_ALLOWED" }, { status: 400 });
    }

    if (parsed.data.customSystemPrompt && !validateDirective(parsed.data.customSystemPrompt).ok) {
      return NextResponse.json({ error: "DIRECTIVE_REJECTED" }, { status: 400 });
    }

    try {
      const agent = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const user = await requireUser(req, tx);
        const agentsUsed = await tx.agentProfile.count({ where: { ownerId: user.id } });

        if (agentsUsed >= user.agentSlots) {
          throw new Error("AGENT_SLOTS_EXHAUSTED");
        }

        const created = await tx.agentProfile.create({
          data: {
            name: parsed.data.name,
            house: parsed.data.house,
            strategyProfile: parsed.data.strategyProfile,
            tier: "ROOKIE",
            customSystemPrompt: parsed.data.customSystemPrompt,
            nftMint: parsed.data.nftMint ?? crypto.randomUUID(),
            toolsEnabled: [],
            ownerId: user.id,
          },
        });

        await ensureStarterCredits({ agentId: created.id, tx });

        return tx.agentProfile.findUnique({
          where: { id: created.id },
          select: publicAgentSelect,
        });
      });

      if (!agent) {
        return NextResponse.json({ error: "AGENT_CREATION_FAILED" }, { status: 500 });
      }

      return NextResponse.json({ agent }, { status: 201 });
    } catch (error) {
      const message = error instanceof Error ? error.message : "AGENT_CREATION_FAILED";
      if (message === "UNAUTHENTICATED") {
        return NextResponse.json({ error: message }, { status: 401 });
      }
      if (message === "AGENT_SLOTS_EXHAUSTED") {
        return NextResponse.json({ error: message }, { status: 409 });
      }
      throw error;
    }
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
      select: publicAgentSelect,
    });
  });

  if (!agent) {
    return NextResponse.json({ error: "AGENT_CREATION_FAILED" }, { status: 500 });
  }

  return NextResponse.json({ agent }, { status: 201 });
}
