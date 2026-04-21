import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const team = await prisma.team.upsert({
    where: { slug: "acme" },
    update: { name: "Acme Engineering", plan: "free" },
    create: {
      name: "Acme Engineering",
      slug: "acme",
      plan: "free",
    },
  });

  const users = [
    {
      email: "admin@acme.com",
      name: "Acme Admin",
      githubId: "gh_admin_acme",
      avatarUrl: null,
      role: "admin",
    },
    {
      email: "dev1@acme.com",
      name: "Acme Dev One",
      githubId: "gh_dev1_acme",
      avatarUrl: null,
      role: "developer",
    },
    {
      email: "dev2@acme.com",
      name: "Acme Dev Two",
      githubId: "gh_dev2_acme",
      avatarUrl: null,
      role: "developer",
    },
  ] as const;

  const createdUsers = [] as Array<{ id: string; email: string; role: string }>;

  for (const item of users) {
    const user = await prisma.user.upsert({
      where: { email: item.email },
      update: {
        name: item.name,
        githubId: item.githubId,
        avatarUrl: item.avatarUrl,
      },
      create: {
        email: item.email,
        name: item.name,
        githubId: item.githubId,
        avatarUrl: item.avatarUrl,
      },
    });

    createdUsers.push({ id: user.id, email: user.email, role: item.role });

    await prisma.teamMember.upsert({
      where: {
        userId_teamId: {
          userId: user.id,
          teamId: team.id,
        },
      },
      update: { role: item.role },
      create: {
        userId: user.id,
        teamId: team.id,
        role: item.role,
      },
    });
  }

  const existingConnection = await prisma.githubConnection.findFirst({
    where: {
      teamId: team.id,
      repoUrl: "https://github.com/acme/main-app",
    },
  });

  const connection = existingConnection
    ? await prisma.githubConnection.update({
        where: { id: existingConnection.id },
        data: {
          repoName: "acme/main-app",
          status: "completed",
          lastIngestedAt: new Date(),
        },
      })
    : await prisma.githubConnection.create({
        data: {
          teamId: team.id,
          repoUrl: "https://github.com/acme/main-app",
          repoName: "acme/main-app",
          status: "completed",
          lastIngestedAt: new Date(),
        },
      });

  const existingQueries = await prisma.query.findMany({
    where: { teamId: team.id },
    select: { id: true },
  });
  if (existingQueries.length > 0) {
    await prisma.query.deleteMany({
      where: {
        id: { in: existingQueries.map((q) => q.id) },
      },
    });
  }

  const mockQueries = [
    {
      question: "How does auth middleware work in MirrorMind?",
      answer:
        "Auth middleware validates bearer tokens and attaches user/team context.",
    },
    {
      question: "Where is ingestion status tracked?",
      answer:
        "Ingestion status is tracked in ingestion_jobs and reflected in github_connections.",
    },
    {
      question: "How are PR reviews generated?",
      answer:
        "PR review jobs are enqueued and processed by the PR worker using the AI service.",
    },
    {
      question: "How does team isolation work?",
      answer:
        "All query paths are scoped by team_id and separated storage namespaces.",
    },
    {
      question: "How does caching reduce AI calls?",
      answer: "Repeated questions return Redis-cached answers for one hour.",
    },
  ];

  const citations = [
    {
      id: "src-1",
      url: "https://github.com/acme/main-app/pull/101",
      type: "pull_request",
      author: "dev1",
      preview: "Auth middleware checks bearer token",
    },
  ];

  for (let i = 0; i < mockQueries.length; i += 1) {
    const user = createdUsers[i % createdUsers.length];
    await prisma.query.create({
      data: {
        teamId: team.id,
        userId: user.id,
        conversationId: `conv-${i + 1}`,
        question: mockQueries[i].question,
        answer: mockQueries[i].answer,
        sourcesJson: citations,
        rating: i % 2 === 0 ? 1 : null,
      },
    });
  }

  const existingReviews = await prisma.pRReview.findMany({
    where: { teamId: team.id },
    select: { id: true },
  });
  if (existingReviews.length > 0) {
    await prisma.pRReview.deleteMany({
      where: {
        id: { in: existingReviews.map((r) => r.id) },
      },
    });
  }

  const mockIssues = [
    {
      severity: "warning",
      description: "Potential null access in auth flow",
      suggestion: "Add a null guard before dereferencing",
    },
  ];

  const reviewRows = [
    {
      prNumber: 201,
      prUrl: "https://github.com/acme/main-app/pull/201",
      prTitle: "Improve token refresh flow",
      reviewSummary:
        "Solid improvement with one defensive coding recommendation.",
    },
    {
      prNumber: 202,
      prUrl: "https://github.com/acme/main-app/pull/202",
      prTitle: "Optimize ingestion polling",
      reviewSummary:
        "Polling optimization looks good; review found minor reliability issue.",
    },
    {
      prNumber: 203,
      prUrl: "https://github.com/acme/main-app/pull/203",
      prTitle: "Add dashboard activity counters",
      reviewSummary: "Implementation is clean and follows team conventions.",
    },
  ];

  for (const row of reviewRows) {
    await prisma.pRReview.create({
      data: {
        teamId: team.id,
        repoName: connection.repoName,
        prNumber: row.prNumber,
        prUrl: row.prUrl,
        prTitle: row.prTitle,
        reviewSummary: row.reviewSummary,
        issuesJson: mockIssues,
        status: "completed",
      },
    });
  }

  await prisma.subscription.upsert({
    where: { teamId: team.id },
    update: {
      plan: "free",
      status: "active",
    },
    create: {
      teamId: team.id,
      plan: "free",
      status: "active",
    },
  });

  console.info("Seed complete for Acme Engineering test data.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
