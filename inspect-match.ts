import { prisma } from "./lib/prisma";

async function checkMatch() {
  const match = await prisma.match.findUnique({
    where: { id: 'cmo310xk20000dwipiy55wf0c' },
  });
  console.log(JSON.stringify(match, null, 2));
}

checkMatch().catch(console.error).finally(() => prisma.$disconnect());
