import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { refundLockedMatchStakeCredits } from "@/lib/credits";

/**
 * Cancel a match.
 * Currently allowed for WAITING or ACTIVE matches.
 * Refunds credits if locked.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ matchId: string }> }) {
  const params = await ctx.params;
  const matchId = params.matchId;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const match = await tx.match.findUnique({
        where: { id: matchId },
        select: { id: true, status: true, stakeMode: true, creditsLockedAt: true, creditsSettledAt: true }
      });

      if (!match) throw new Error("MATCH_NOT_FOUND");
      if (match.status === "COMPLETED") throw new Error("MATCH_ALREADY_COMPLETED");
      if (match.status === "CANCELLED") throw new Error("MATCH_ALREADY_CANCELLED");

      // Refund if credits were locked
      if (match.stakeMode === "CREDITS" && match.creditsLockedAt && !match.creditsSettledAt) {
        await refundLockedMatchStakeCredits({ tx, matchId });
      }

      const updated = await tx.match.update({
        where: { id: matchId },
        data: { status: "CANCELLED" },
      });

      return updated;
    });

    return NextResponse.json({ match: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "CANCEL_FAILED";
    if (message === "MATCH_NOT_FOUND") return NextResponse.json({ error: message }, { status: 404 });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
