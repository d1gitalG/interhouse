import { NextResponse } from "next/server";

import { getTournament } from "@/lib/tournaments";

export async function GET(_req: Request, ctx: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await ctx.params;
  try {
    const tournament = await getTournament(tournamentId);
    return NextResponse.json({ tournament });
  } catch (error) {
    const message = error instanceof Error ? error.message : "TOURNAMENT_GET_FAILED";
    if (message === "TOURNAMENT_NOT_FOUND") return NextResponse.json({ error: message }, { status: 404 });
    throw error;
  }
}
