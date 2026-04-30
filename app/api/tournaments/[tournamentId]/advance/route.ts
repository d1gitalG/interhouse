import { NextResponse } from "next/server";
import { z } from "zod";

import { requireInternalSecret } from "@/lib/internal-auth";
import { advanceTournamentFromMatch } from "@/lib/tournaments";

const AdvanceBodySchema = z.object({
  matchId: z.string().min(1),
});

export async function POST(req: Request, ctx: { params: Promise<{ tournamentId: string }> }) {
  const unauthorized = requireInternalSecret(req);
  if (unauthorized) return unauthorized;

  const { tournamentId } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = AdvanceBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_BODY", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const tournament = await advanceTournamentFromMatch(parsed.data.matchId, tournamentId);
    return NextResponse.json({ ok: true, tournament });
  } catch (error) {
    const message = error instanceof Error ? error.message : "TOURNAMENT_ADVANCE_FAILED";
    if (message === "TOURNAMENT_MATCH_NOT_FOUND") return NextResponse.json({ error: message }, { status: 404 });
    if (message === "MATCH_NOT_COMPLETED" || message === "NEXT_TOURNAMENT_MATCH_FULL") {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    throw error;
  }
}
