"use client";

import { useState } from "react";

import { IngestionStatus } from "@/components/dashboard/IngestionStatus";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  useConnectRepoMutation,
  useDisconnectRepoMutation,
  useIngestionStatusQuery,
  useReposQuery,
  useSyncRepoMutation,
} from "@/lib/queries";

export default function IntegrationsPage() {
  const { toast } = useToast();
  const { data: repos = [] } = useReposQuery();
  const { data: ingestion = [] } = useIngestionStatusQuery();
  const connectMutation = useConnectRepoMutation();
  const disconnectMutation = useDisconnectRepoMutation();
  const syncMutation = useSyncRepoMutation();
  const [repoUrl, setRepoUrl] = useState("");

  const onConnect = async () => {
    if (!repoUrl.trim()) {
      return;
    }

    try {
      await connectMutation.mutateAsync({ repoUrl });
      toast({
        title: "Repository connected",
        description: "Ingestion job started in background.",
      });
      setRepoUrl("");
    } catch (error) {
      toast({
        title: "Failed to connect repository",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const onDisconnect = async (repoId: string) => {
    try {
      await disconnectMutation.mutateAsync(repoId);
      toast({ title: "Repository disconnected" });
    } catch (error) {
      toast({
        title: "Failed to disconnect repository",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const onSync = async (repoId: string) => {
    try {
      await syncMutation.mutateAsync(repoId);
      toast({
        title: "Sync queued",
        description: "Repository sync job started in background.",
      });
    } catch (error) {
      toast({
        title: "Failed to start sync",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">Connected Integrations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="https://github.com/org/repo"
              value={repoUrl}
              onChange={(event) => setRepoUrl(event.target.value)}
            />
            <Button
              onClick={() => void onConnect()}
              disabled={connectMutation.isPending}
            >
              {connectMutation.isPending
                ? "Connecting..."
                : "Connect GitHub Repo"}
            </Button>
          </div>

          <div className="space-y-2">
            {repos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No repositories connected yet.
              </p>
            ) : (
              repos.map((repo) => (
                <div
                  key={repo.id}
                  className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {repo.repoName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Last synced: {repo.lastSyncedAt ?? "Never"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void onSync(repo.id)}
                      disabled={syncMutation.isPending}
                    >
                      Sync Now
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => void onDisconnect(repo.id)}
                      disabled={disconnectMutation.isPending}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <IngestionStatus items={ingestion} />
    </div>
  );
}
