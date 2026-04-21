import { StatusBadge } from "@/components/ui/StatusBadge";

type ReviewStatusBadgeProps = {
  status: string;
};

export function ReviewStatusBadge({ status }: ReviewStatusBadgeProps) {
  return <StatusBadge status={status} />;
}
