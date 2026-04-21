import { ReviewStatusBadge } from "@/components/review/ReviewStatusBadge";
import type { PullRequestItem } from "@/types/domain";

type PRListProps = {
  items: PullRequestItem[];
  selectedId?: string;
  onSelect: (item: PullRequestItem) => void;
};

export function PRList({ items, selectedId, onSelect }: PRListProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-muted/40 text-muted-foreground">
          <tr>
            <th className="px-4 py-3">PR Title</th>
            <th className="px-4 py-3">Author</th>
            <th className="px-4 py-3">Repo</th>
            <th className="px-4 py-3">Opened</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              className={`cursor-pointer border-t border-border ${selectedId === item.id ? "bg-primary/10" : "hover:bg-muted/30"}`}
              onClick={() => onSelect(item)}
            >
              <td className="px-4 py-3 text-foreground">{item.title}</td>
              <td className="px-4 py-3 text-muted-foreground">{item.author}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {item.repoName}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {new Date(item.openedAt).toLocaleDateString()}
              </td>
              <td className="px-4 py-3">
                <ReviewStatusBadge status={item.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
