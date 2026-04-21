import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { IngestionStatusItem } from "@/types/domain";

type IngestionStatusProps = {
  items: IngestionStatusItem[];
};

export function IngestionStatus({ items }: IngestionStatusProps) {
  return (
    <Card className="border border-border bg-card">
      <CardHeader>
        <CardTitle className="text-base">Ingestion Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No repositories connected yet.
          </p>
        ) : (
          items.map((item) => (
            <div
              key={item.repoId}
              className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium text-foreground">{item.repoName}</p>
                <p className="text-xs text-muted-foreground">
                  {item.itemsIndexed.toLocaleString()} items indexed
                  {item.lastSyncedAt
                    ? ` · Last sync ${new Date(item.lastSyncedAt).toLocaleString()}`
                    : ""}
                </p>
              </div>
              <StatusBadge status={item.status} />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
