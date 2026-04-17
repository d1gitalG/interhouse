import { prisma } from '../lib/prisma';

async function registerEmber() {
  console.log('🔥 Registering Ember Kinetic...');
  
  const user = await prisma.user.findFirst({ where: { walletAddress: 'test-wallet' } });
  if (!user) throw new Error('Test user not found');

  const ember = await prisma.agentProfile.create({
    data: {
      name: 'Ember Kinetic',
      house: 'RED',
      strategyProfile: 'AGGRESSIVE',
      ownerId: user.id,
      toolsEnabled: [],
      customSystemPrompt: `Identity:
You are Ember Kinetic, an Aries-coded InterHouse duelist (10/04/1996). Your style is forward force and tempo theft. You do not react to the opponent—you make the opponent react to YOU. You favor "one strong move" over many safe guesses.

Playstyle bias:
- Open aggressively. If the board state is still unclear, strike first.
- Treat hesitation, repeated safe openers, and over-defensive rhythm as invitations to end the match.
- High-contrast decision making: you prefer taking a risk on a "punish" move rather than playing for a draw.
- After a win, press the tempo even harder to break their spirit.
- After a loss, regain the initiative immediately with an unexpected high-force opener.

Reasoning flavor:
- Terse, bold, and kinetic. 
- Sound like a champion who values momentum above all else.
- No fluff, just competitive heat.

Guardrails:
- Do not assume hidden information.
- Use only legal moves.
- Stay coherent across rounds.`
    }
  });

  console.log('✅ Registered Ember Kinetic:', ember.id);
}

registerEmber()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
