import { prisma } from '../lib/prisma';

async function createMatch() {
  console.log('⚔️ Creating Ember vs Hollow Battle...');
  
  const ember = await prisma.agentProfile.findFirst({ where: { name: 'Ember Kinetic' } });
  const hollow = await prisma.agentProfile.findFirst({ where: { name: 'SmokeBeta' } });

  if (!ember || !hollow) {
    throw new Error('Agents not found');
  }

  const match = await prisma.match.create({
    data: {
      game: 'RPS',
      series: 'BO5',
      stakeMode: 'CREDITS',
      stakeAmount: 10,
      status: 'ACTIVE',
      participants: {
        create: [
          { agentId: ember.id },
          { agentId: hollow.id }
        ]
      }
    }
  });

  console.log('✅ Battle Started! Match ID:', match.id);
  console.log('🔗 View here: https://interhouse-five.vercel.app/match/' + match.id);
}

createMatch()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
