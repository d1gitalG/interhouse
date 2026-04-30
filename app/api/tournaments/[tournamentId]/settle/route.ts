import { NextResponse } from "next/server";

import { settleTournament } from "@/lib/tournaments";

export async function POST(_req: Request, ctx: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await ctx.params;
  try {
    const tournament = await settleTournament(tournamentId);
    return NextResponse.json({ ok: true, tournament });
  } catch (error) {
    const message = error instanceof Error ? error.message : "TOURNAMENT_SETTLE_FAILED";
    if (message === "TOURNAMENT_NOT_FOUND") return NextResponse.json({ error: message }, { status: 404 });
    if (message === "TOURNAMENT_WINNER_NOT_SET") return NextResponse.json({ error: message }, { status: 409 });
    throw error;
  }
}
