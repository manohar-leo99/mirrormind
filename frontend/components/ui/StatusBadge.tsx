import { Badge } from "@/components/ui/badge";

type StatusBadgeProps = {
  status: string;
};

const statusStyles: Record<string, string> = {
  connected: "bg-[#22C55E]/20 text-[#22C55E]",
  ready: "bg-[#22C55E]/20 text-[#22C55E]",
  indexing: "bg-[#F59E0B]/20 text-[#F59E0B]",
  processing: "bg-[#F59E0B]/20 text-[#F59E0B]",
  error: "bg-[#EF4444]/20 text-[#EF4444]",
  failed: "bg-[#EF4444]/20 text-[#EF4444]",
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const normalized = status.toLowerCase();
  const style = statusStyles[normalized] ?? "bg-muted text-foreground";

  return <Badge className={style}>{status}</Badge>;
}
