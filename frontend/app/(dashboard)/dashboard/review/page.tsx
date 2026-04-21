"use client";

import { useMemo, useState } from "react";

import { PRList } from "@/components/review/PRList";
import { PRReviewCard } from "@/components/review/PRReviewCard";
import { useToast } from "@/hooks/use-toast";
import {
  usePullRequestsQuery,
  useTriggerPRReviewMutation,
} from "@/lib/queries";

export default function ReviewPage() {
  const { toast } = useToast();
  const { data: prs = [] } = usePullRequestsQuery();
  const triggerMutation = useTriggerPRReviewMutation();
  const [selectedPrId, setSelectedPrId] = useState<string | undefined>();

  const selectedPr = useMemo(() => {
    if (!selectedPrId) {
      return prs[0];
    }
    return prs.find((item) => item.id === selectedPrId) ?? prs[0];
  }, [prs, selectedPrId]);

  const onRereview = async (prNumber: number, repoName: string) => {
    try {
      await triggerMutation.mutateAsync({ prNumber, repoName });
      toast({
        title: "Review queued",
        description: "MirrorReview started a fresh analysis.",
      });
    } catch (error) {
      toast({
        title: "Failed to trigger re-review",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <PRList
        items={prs}
        selectedId={selectedPr?.id}
        onSelect={(item) => setSelectedPrId(item.id)}
      />
      <PRReviewCard
        item={selectedPr}
        onRereview={onRereview}
        isLoading={triggerMutation.isPending}
      />
    </div>
  );
}
