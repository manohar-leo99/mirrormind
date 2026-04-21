const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const rows = await prisma.query.findMany({
    where: { answer: { contains: 'AI service is not responding. Try again.' } },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { createdAt: true, teamId: true, question: true }
  });
  console.log('count', rows.length);
  for (const r of rows) {
    console.log(`${r.createdAt.toISOString()} | ${r.teamId} | ${r.question}`);
  }
  await prisma.$disconnect();
})().catch(async (e)=>{console.error(e); await prisma.$disconnect(); process.exit(1);});
