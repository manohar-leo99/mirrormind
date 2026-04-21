"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";

import { IngestionStatus } from "@/components/dashboard/IngestionStatus";
import { QuickStartPrompts } from "@/components/dashboard/QuickStartPrompts";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { Card, CardContent } from "@/components/ui/card";
import {
  useIngestionStatusQuery,
  usePullRequestsQuery,
  useReposQuery,
  useTeamQuery,
} from "@/lib/queries";

export default function DashboardHomePage() {
  const router = useRouter();
  const { data: team } = useTeamQuery();
  const { data: repos = [] } = useReposQuery();
  const { data: ingestion = [] } = useIngestionStatusQuery();
  const { data: prs = [] } = usePullRequestsQuery();

  const activity = useMemo(
    () =>
      [
        ...prs.slice(0, 2).map((pr) => ({
          id: `review-${pr.id}`,
          type: "review",
          text: `PR #${pr.prNumber} review updated for ${pr.repoName}`,
          createdAt: pr.openedAt,
        })),
        ...ingestion.slice(0, 2).map((item) => ({
          id: `repo-${item.repoId}`,
          type: "repo",
          text: `${item.repoName} ingestion is ${item.status}`,
          createdAt: item.lastSyncedAt ?? new Date().toISOString(),
        })),
      ].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [ingestion, prs],
  );

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-10">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:col-span-10 xl:grid-cols-4">
        <StatsCard title="Total Queries" value={team?.totalQueries ?? 0} />
        <StatsCard
          title="PRs Reviewed"
          value={team?.prsReviewed ?? prs.length}
        />
        <StatsCard title="Team Members" value={team?.teamMembers ?? 0} />
        <StatsCard
          title="Repos Connected"
          value={team?.reposConnected ?? repos.length}
        />
      </div>

      <div className="xl:col-span-10">
        <IngestionStatus items={ingestion} />
      </div>

      <div className="xl:col-span-6">
        <RecentActivity items={activity} />
      </div>

      <div className="xl:col-span-4">
        {repos.length === 0 ? (
          <QuickStartPrompts
            prompts={[
              "How does our authentication system work?",
              "Show recent architectural decisions from PRs",
              "Find examples of error handling patterns in our code",
            ]}
            onPromptSelect={(prompt) => {
              router.push(
                `/dashboard/chat?prompt=${encodeURIComponent(prompt)}`,
              );
            }}
          />
        ) : (
          <Card className="border border-border bg-card">
            <CardContent className="p-4 text-sm text-muted-foreground">
              Repositories are connected. Ask MirrorChat for team-specific
              context from your commits and pull requests.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
