import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, ctx: { params: Promise<{ matchId: string }> }) {
  const params = await ctx.params;
  const matchId = params.matchId;

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      participants: { include: { agent: true } },
      moves: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!match) {
    return NextResponse.json({ error: "MATCH_NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ match });
}
