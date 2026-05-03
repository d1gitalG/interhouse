import { NextResponse } from "next/server";

import { buildTournamentAudit, stableStringify } from "@/lib/tournament-audit";
import { getTournament } from "@/lib/tournaments";

export async function GET(_req: Request, ctx: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await ctx.params;

  try {
    const tournament = await getTournament(tournamentId);
    const audit = buildTournamentAudit(tournament);

    return new NextResponse(`${stableStringify(audit)}\n`, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="interhouse-tournament-audit-${tournament.id}.json"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "TOURNAMENT_AUDIT_FAILED";
    if (message === "TOURNAMENT_NOT_FOUND") return NextResponse.json({ error: message }, { status: 404 });
    throw error;
  }
}
