import { NextResponse } from "next/server";
import { z } from "zod";

import { requireInternalSecret } from "@/lib/internal-auth";
import { createTournament } from "@/lib/tournaments";
import { prisma } from "@/lib/prisma";
import { publicAgentSelect } from "@/lib/public-agent";

const GameSchema = z.enum(["RPS", "TTT", "C4", "CHESS", "CHECKERS"]);
const SeriesSchema = z.enum(["QUICK", "BO3", "BO5"]);

const CreateTournamentSchema = z.object({
  name: z.string().min(1),
  game: GameSchema.default("RPS"),
  series: SeriesSchema.default("BO3"),
  entryFeeCredits: z.number().int().nonnegative().default(0),
  agentIds: z.array(z.string().min(1)).optional(),
});

export async function GET() {
  const tournaments = await prisma.tournament.findMany({
    include: {
      entries: { include: { agent: { select: publicAgentSelect } }, orderBy: { seed: "asc" } },
      matches: { include: { match: true }, orderBy: [{ round: "asc" }, { slot: "asc" }] },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ tournaments });
}

export async function POST(req: Request) {
  const unauthorized = requireInternalSecret(req);
  if (unauthorized) return unauthorized;

  const body = await req.json().catch(() => null);
  const parsed = CreateTournamentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_BODY", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const tournament = await createTournament(parsed.data);
    return NextResponse.json({ tournament }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "TOURNAMENT_CREATE_FAILED";
    if (message === "AGENT_NOT_FOUND") return NextResponse.json({ error: message }, { status: 404 });
    if (message === "INSUFFICIENT_CREDITS" || message === "INVALID_ENTRY_FEE") {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    throw error;
  }
}
