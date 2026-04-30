import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const HouseSchema = z.enum(["RED", "GREEN", "BLUE", "YELLOW"]);
const StrategySchema = z.enum(["AGGRESSIVE", "DEFENSIVE", "CHAOTIC", "CALCULATED", "ADAPTIVE"]);
const TierSchema = z.enum(["ROOKIE", "CONTENDER", "CHAMPION", "ELITE"]);
const ToolSchema = z.enum(["BOARD_ANALYZER", "WIN_PROBABILITY", "MOVE_HISTORY"]);

const UpdateAgentSchema = z.object({
  name: z.string().min(1).optional(),
  house: HouseSchema.optional(),
  strategyProfile: StrategySchema.optional(),
  tier: TierSchema.optional(),
  customSystemPrompt: z.string().min(1).nullable().optional(),
  toolsEnabled: z.array(ToolSchema).optional(),
  nftMint: z.string().optional(),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ agentId: string }> }
) {
  const params = await ctx.params;
  const agentId = params.agentId;

  const agent = await prisma.agentProfile.findUnique({
    where: { id: agentId },
  });

  if (!agent) {
    return NextResponse.json({ error: "AGENT_NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ agent });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ agentId: string }> }
) {
  const params = await ctx.params;
  const agentId = params.agentId;

  const body = await req.json().catch(() => null);
  const parsed = UpdateAgentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_BODY", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const updated = await prisma.agentProfile.update({
      where: { id: agentId },
      data: parsed.data,
    });
    return NextResponse.json({ agent: updated });
  } catch {
    return NextResponse.json({ error: "AGENT_UPDATE_FAILED" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ agentId: string }> }
) {
  const params = await ctx.params;
  const agentId = params.agentId;

  try {
    // Check if agent is in any active matches
    const activeMatches = await prisma.match.count({
      where: {
        status: "ACTIVE",
        participants: {
          some: { agentId }
        }
      }
    });

    if (activeMatches > 0) {
      return NextResponse.json(
        { error: "AGENT_IN_ACTIVE_MATCH" },
        { status: 400 }
      );
    }

    await prisma.agentProfile.delete({
      where: { id: agentId },
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "AGENT_DELETE_FAILED" }, { status: 500 });
  }
}
