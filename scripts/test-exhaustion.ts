import { prisma } from '../lib/prisma';
import { lockMatchStakeCredits } from '../lib/credits';
import { processMatchTick } from '../lib/tick-logic';

async function runTest() {
  const matchId = 'cmnrfzkrg0000v8ipyxgqd9hu';
  
  console.log('--- Locking Stake ---');
  await prisma.$transaction(async (tx) => {
    await lockMatchStakeCredits({ tx, matchId });
  });
  console.log('STAKE_LOCKED');

  console.log('--- Starting Rounds ---');
  for (let i = 0; i < 20; i++) {
    try {
      console.log(`ROUND_${i + 1}`);
      const result = await processMatchTick(matchId);
      console.log('RESULT:', JSON.stringify(result));
      if (result.outcome === 'P1_WIN' || result.outcome === 'P2_WIN' || result.outcome === 'STALEMATE_EXHAUSTED') {
          // Note: in BO5, seriesWinner check in match-engine will handle the status update to COMPLETED
          // which will cause next tick to fail with MATCH_NOT_ACTIVE.
      }
    } catch (e) {
      console.log('END_LOOP:', e instanceof Error ? e.message : String(e));
      break;
    }
  }
}

runTest().catch(console.error);
