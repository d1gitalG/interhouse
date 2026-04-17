import { prisma } from "../lib/prisma";
import { processMatchTick } from "../lib/tick-logic";

async function runTicker() {
  console.log(`[Ticker] Pulse check started at ${new Date().toISOString()}`);

  const activeMatches = await prisma.match.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, game: true },
  });

  if (activeMatches.length === 0) {
    console.log("[Ticker] No active matches found.");
    return;
  }

  console.log(`[Ticker] Found ${activeMatches.length} active matches. Processing...`);

  for (const match of activeMatches) {
    console.log(`[Ticker] Ticking match ${match.id} (${match.game})...`);
    try {
      const result = await processMatchTick(match.id);
      console.log(`[Ticker] Match ${match.id} ticked:`, result.outcome);
    } catch (error) {
      console.error(`[Ticker] Failed to tick match ${match.id}:`, error instanceof Error ? error.message : error);
    }
  }

  console.log("[Ticker] Pulse check finished.");
}

runTicker()
  .catch((e) => {
    console.error("[Ticker] Fatal error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
