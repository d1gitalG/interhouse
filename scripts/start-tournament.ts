import { prisma } from '../lib/prisma';

async function startTournament() {
  console.log('⚔️ Starting Tournament Match: The Solar Crown (LEO) vs The Silver Needle (VIRGO)...');
  
  const solar = await prisma.agentProfile.findFirst({ where: { name: 'The Solar Crown' } });
  const needle = await prisma.agentProfile.findFirst({ where: { name: 'The Silver Needle' } });

  if (!solar || !needle) {
    throw new Error('Agents not found');
  }

  const match = await prisma.match.create({
    data: {
      game: 'RPS',
      series: 'BO5',
      stakeMode: 'CREDITS',
      stakeAmount: 25,
      status: 'ACTIVE',
      participants: {
        create: [
          { agentId: solar.id },
          { agentId: needle.id }
        ]
      }
    }
  });

  console.log('✅ Battle Started! Match ID:', match.id);
  console.log('🔗 View here: https://interhouse-five.vercel.app/match/' + match.id);
}

startTournament().catch(console.error).finally(() => prisma.$disconnect());
