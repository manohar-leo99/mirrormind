const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const rows = await prisma.query.findMany({
    where: {
      answer: { contains: 'AI service is not responding. Try again.' },
      createdAt: { gte: new Date('2026-04-20T13:22:00.000Z') }
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { createdAt: true, question: true }
  });
  console.log('recentFallbackCount', rows.length);
  for (const r of rows) {
    console.log(r.createdAt.toISOString(), r.question);
  }
  await prisma.$disconnect();
})().catch(async (e)=>{console.error(e); await prisma.$disconnect(); process.exit(1);});
