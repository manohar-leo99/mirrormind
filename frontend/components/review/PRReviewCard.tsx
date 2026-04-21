import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CodeBlock } from "@/components/ui/CodeBlock";
import type { PullRequestItem } from "@/types/domain";

type PRReviewCardProps = {
  item?: PullRequestItem;
  onRereview: (prNumber: number, repoName: string) => void;
  isLoading?: boolean;
};

export function PRReviewCard({
  item,
  onRereview,
  isLoading = false,
}: PRReviewCardProps) {
  if (!item) {
    return (
      <Card className="border border-border bg-card">
        <CardContent className="p-6 text-sm text-muted-foreground">
          Select a PR to see AI review details.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-border bg-card">
      <CardHeader className="space-y-3">
        <CardTitle className="text-base">{item.title}</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{item.repoName}</Badge>
          <Badge variant="outline">#{item.prNumber}</Badge>
          <Button
            variant="outline"
            size="sm"
            disabled={isLoading}
            onClick={() => onRereview(item.prNumber, item.repoName)}
          >
            {isLoading ? "Re-reviewing..." : "Re-review"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            render={<Link href={item.prUrl} target="_blank" rel="noreferrer" />}
          >
            Open on GitHub
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm font-semibold text-foreground">Summary</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {item.summary ?? "No summary available yet."}
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-foreground">Issues Found</p>
          {(item.issues ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No issues found.</p>
          ) : (
            item.issues?.map((issue, index) => (
              <div
                key={`${issue.message}-${index}`}
                className="rounded-lg border border-border p-3"
              >
                <Badge
                  className={
                    issue.severity === "error"
                      ? "bg-[#EF4444]/20 text-[#EF4444]"
                      : issue.severity === "warning"
                        ? "bg-[#F59E0B]/20 text-[#F59E0B]"
                        : "bg-primary/20 text-primary"
                  }
                >
                  {issue.severity}
                </Badge>
                <p className="mt-2 text-sm text-foreground">{issue.message}</p>
                {issue.snippet ? (
                  <CodeBlock code={issue.snippet} language="typescript" />
                ) : null}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
