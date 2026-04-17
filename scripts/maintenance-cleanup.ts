import { prisma } from "../lib/prisma";
import { refundLockedMatchStakeCredits } from "../lib/credits";

async function cleanup() {
  const now = new Date();
  const waitingThreshold = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours
  const activeThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours

  console.log(`[Maintenance] Starting stale match cleanup at ${now.toISOString()}`);

  const staleMatches = await prisma.match.findMany({
    where: {
      OR: [
        { status: "WAITING", createdAt: { lt: waitingThreshold } },
        { status: "ACTIVE", createdAt: { lt: activeThreshold } },
      ],
    },
    select: {
      id: true,
      status: true,
      stakeMode: true,
      creditsLockedAt: true,
      creditsSettledAt: true,
      createdAt: true,
    },
  });

  console.log(`[Maintenance] Found ${staleMatches.length} matches for cleanup.`);

  for (const match of staleMatches) {
    console.log(`[Maintenance] Processing match ${match.id} (${match.status})...`);
    try {
      await prisma.$transaction(async (tx) => {
        // Refund if credits were locked and not yet settled
        if (match.stakeMode === "CREDITS" && match.creditsLockedAt && !match.creditsSettledAt) {
          console.log(`[Maintenance] Refunding locked credits for match ${match.id}...`);
          await refundLockedMatchStakeCredits({ tx, matchId: match.id });
        }

        await tx.match.update({
          where: { id: match.id },
          data: { status: "CANCELLED" },
        });
      });
      console.log(`[Maintenance] Match ${match.id} successfully cancelled and refunded (if applicable).`);
    } catch (error) {
      console.error(`[Maintenance] Failed to cleanup match ${match.id}:`, error);
    }
  }

  console.log(`[Maintenance] Cleanup finished.`);
}

cleanup()
  .catch((e) => {
    console.error("[Maintenance] Fatal error during cleanup:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
