import { NextResponse } from "next/server";
import { z } from "zod";

import { applyCreditsDelta } from "@/lib/credits";
import { requireInternalSecret } from "@/lib/internal-auth";
import { prisma } from "@/lib/prisma";

const CreditsBodySchema = z.object({
  amount: z.number().int().finite(),
});

/**
 * GET /api/agents/[agentId]/credits
 * Returns the current credit balance and locked credits for an agent.
 */
export async function GET(req: Request, ctx: { params: Promise<{ agentId: string }> }) {
  const params = await ctx.params;
  const agentId = params.agentId;

  const agent = await prisma.agentProfile.findUnique({
    where: { id: agentId },
    select: { id: true, credits: true, lockedCredits: true },
  });

  if (!agent) {
    return NextResponse.json({ error: "AGENT_NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ credits: agent.credits, lockedCredits: agent.lockedCredits });
}

/**
 * POST /api/agents/[agentId]/credits
 * Manually adjust an agent's credit balance (Admin/Internal use).
 * Requires X-Internal-Secret header.
 */
export async function POST(req: Request, ctx: { params: Promise<{ agentId: string }> }) {
  const params = await ctx.params;
  const agentId = params.agentId;

  const unauthorized = requireInternalSecret(req);
  if (unauthorized) return unauthorized;

  const body = await req.json().catch(() => null);
  const parsed = CreditsBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_BODY", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const result = await applyCreditsDelta({
      agentId,
      amount: parsed.data.amount,
      preventNegative: true,
    });

    return NextResponse.json({ ok: true, newBalance: result.newBalance });
  } catch (error) {
    const message = error instanceof Error ? error.message : "CREDITS_ADJUST_FAILED";
    if (message === "AGENT_NOT_FOUND") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message === "INSUFFICIENT_CREDITS") {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    throw error;
  }
}
