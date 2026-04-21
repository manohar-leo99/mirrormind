const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const conns = await prisma.githubConnection.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      ingestionJobs: {
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: { id:true, status:true, errorMessage:true, itemsProcessed:true, totalItems:true, createdAt:true, startedAt:true, completedAt:true }
      }
    }
  });
  for (const c of conns) {
    console.log(`CONN ${c.repoName} | status=${c.status} | lastIngested=${c.lastIngestedAt ? c.lastIngestedAt.toISOString() : 'null'}`);
    for (const j of c.ingestionJobs) {
      console.log(`  JOB ${j.id} | ${j.status} | items=${j.itemsProcessed}/${j.totalItems ?? 'null'} | err=${(j.errorMessage||'').slice(0,140)}`);
    }
  }
  await prisma.$disconnect();
})().catch(async (e)=>{console.error(e); await prisma.$disconnect(); process.exit(1);});
