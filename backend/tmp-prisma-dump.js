const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const rows = await prisma.query.findMany({
    orderBy: { createdAt: 'desc' },
    take: 12,
    select: { createdAt: true, teamId: true, question: true, answer: true }
  });
  for (const r of rows) {
    console.log(`${r.createdAt.toISOString()} | ${r.teamId} | Q: ${r.question.slice(0,70)} | A: ${r.answer.slice(0,100)}`);
  }
  await prisma.$disconnect();
})().catch(async (e)=>{console.error(e); await prisma.$disconnect(); process.exit(1);});
