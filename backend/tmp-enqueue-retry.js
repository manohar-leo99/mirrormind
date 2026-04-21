const { PrismaClient } = require('@prisma/client');
const { Queue } = require('bullmq');
const IORedis = require('ioredis');

const prisma = new PrismaClient();
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = new IORedis(redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: false });
const queue = new Queue('ingestion', { connection: redis });

(async () => {
  const failed = await prisma.githubConnection.findFirst({
    where: { status: 'failed' },
    orderBy: { createdAt: 'desc' }
  });

  if (!failed) {
    console.log('No failed github_connection found.');
    return;
  }

  const job = await prisma.ingestionJob.create({
    data: {
      teamId: failed.teamId,
      connectionId: failed.id,
      status: 'pending'
    }
  });

  await queue.add('manual-retry', {
    teamId: failed.teamId,
    repoId: failed.id,
    repoUrl: failed.repoUrl,
    githubToken: 'placeholder-token',
    isFullSync: false
  }, { jobId: job.id });

  console.log('Enqueued ingestion retry:', { repo: failed.repoName, connectionId: failed.id, jobId: job.id });
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
}).finally(async () => {
  await queue.close();
  await redis.quit();
  await prisma.$disconnect();
});
