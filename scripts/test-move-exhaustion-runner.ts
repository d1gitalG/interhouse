import "dotenv/config";
import { prisma } from "../lib/prisma";
import { processMatchTick } from "../lib/tick-logic";
import { lockMatchStakeCredits } from "../lib/credits";

async function testMoveExhaustion() {
  console.log("Setting up test agents...");
  
  // Ensure a test user exists
  let user = await prisma.user.findFirst({ where: { walletAddress: "test-wallet" } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        walletAddress: "test-wallet",
        credits: 10000
      }
    });
  }

  const prompt = "For rounds 1-5, always pick SCISSORS. For rounds 6-10, always pick PAPER. For rounds 11-15, always pick ROCK. Respond with the move in JSON format as requested.";

  // Create two agents
  const agentA = await prisma.agentProfile.upsert({
    where: { nftMint: "agent-a" },
    update: { credits: 5000, customSystemPrompt: prompt },
    create: {
      nftMint: "agent-a",
      name: "ExhaustionTester_A",
      house: "RED",
      strategyProfile: "CALCULATED",
      toolsEnabled: [],
      ownerId: user.id,
      credits: 5000,
      customSystemPrompt: prompt
    }
  });

  const agentB = await prisma.agentProfile.upsert({
    where: { nftMint: "agent-b" },
    update: { credits: 5000, customSystemPrompt: prompt },
    create: {
      nftMint: "agent-b",
      name: "ExhaustionTester_B",
      house: "BLUE",
      strategyProfile: "CALCULATED",
      toolsEnabled: [],
      ownerId: user.id,
      credits: 5000,
      customSystemPrompt: prompt
    }
  });

  console.log("Creating RPS match...");
  const match = await prisma.match.create({
    data: {
      game: "RPS",
      status: "ACTIVE",
      stakeMode: "CREDITS",
      stakeAmount: 10,
      series: "BO5",
      participants: {
        create: [
          { agentId: agentA.id, isCreator: true },
          { agentId: agentB.id, isCreator: false }
        ]
      }
    }
  });

  await prisma.$transaction(async (tx) => {
    await lockMatchStakeCredits({ tx, matchId: match.id });
  });

  console.log(`Match created and locked: ${match.id}. Starting ticks...`);

  for (let i = 1; i <= 20; i++) {
    console.log(`\n--- Round ${i} ---`);
    try {
      const result = await processMatchTick(match.id);
      console.log(`Result: ${result.outcome}`);
      
      const updatedMatch = await prisma.match.findUnique({
        where: { id: match.id },
        include: { moves: { where: { round: i } } }
      });
      
      if (updatedMatch) {
        updatedMatch.moves.forEach(m => {
          console.log(`Agent ${m.agentId.slice(-4)} moved: ${m.move}`);
        });
        
        if (updatedMatch.status !== "ACTIVE") {
          console.log(`Match status changed to: ${updatedMatch.status}`);
          if (updatedMatch.status === "COMPLETED" || updatedMatch.status === "CANCELLED") {
             break;
          }
        }
      }
    } catch (error) {
      console.error(`Error in tick ${i}:`, error instanceof Error ? error.message : String(error));
      break;
    }
  }

  console.log("\nTest finished.");
  await prisma.$disconnect();
}

testMoveExhaustion().catch(console.error);
