import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Citation } from "@/types/domain";

type SourceCitationsProps = {
  sources: Citation[];
};

export function SourceCitations({ sources }: SourceCitationsProps) {
  return (
    <Card className="h-full border border-border bg-card">
      <CardHeader>
        <CardTitle className="text-sm">Source Citations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {sources.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No sources for this response yet.
          </p>
        ) : (
          sources.map((source) => (
            <Link
              key={source.id}
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="block rounded-md border border-border p-2 text-xs hover:bg-muted/40"
            >
              <p className="font-semibold text-foreground">
                {source.type}: {source.id}
              </p>
              <p className="mt-1 text-muted-foreground">{source.preview}</p>
              <p className="mt-1 text-muted-foreground">
                Author: {source.author}
              </p>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
