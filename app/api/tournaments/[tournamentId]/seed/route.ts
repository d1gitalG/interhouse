import { NextResponse } from "next/server";

import { seedTournament } from "@/lib/tournaments";

export async function POST(_req: Request, ctx: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await ctx.params;
  try {
    const tournament = await seedTournament(tournamentId);
    return NextResponse.json({ ok: true, tournament });
  } catch (error) {
    const message = error instanceof Error ? error.message : "TOURNAMENT_SEED_FAILED";
    if (message === "TOURNAMENT_NOT_FOUND") return NextResponse.json({ error: message }, { status: 404 });
    if (message === "TOURNAMENT_NOT_SEEDABLE" || message === "TOURNAMENT_REQUIRES_POWER_OF_TWO_ENTRIES") {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    throw error;
  }
}
