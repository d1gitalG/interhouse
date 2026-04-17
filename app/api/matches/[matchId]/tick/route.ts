import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processMatchTick } from "@/lib/tick-logic";

const MATCH_INCLUDE = {
  participants: { include: { agent: true } },
  moves: { orderBy: { createdAt: "asc" as const } },
} as const;

export async function POST(_req: Request, ctx: { params: Promise<{ matchId: string }> }) {
  const params = await ctx.params;
  const matchId = params.matchId;

  try {
    const result = await processMatchTick(matchId);
    
    // Refresh match to return full state to UI
    const updatedMatch = await prisma.match.findUnique({
      where: { id: matchId },
      include: MATCH_INCLUDE,
    });

    if (!updatedMatch) throw new Error("MATCH_NOT_FOUND");

    const winnerParticipant =
      updatedMatch.winnerId == null
        ? null
        : updatedMatch.participants.find((p) => p.agentId === updatedMatch.winnerId) ?? null;

    return NextResponse.json({
      ...result,
      match: updatedMatch,
      winner: winnerParticipant ? { id: winnerParticipant.id, agent: winnerParticipant.agent } : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "TICK_FAILED";
    const status = message === "MATCH_NOT_FOUND" ? 404 : 409;
    return NextResponse.json({ error: message }, { status });
  }
}
