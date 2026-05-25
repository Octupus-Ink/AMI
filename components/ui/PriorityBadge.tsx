import { Badge } from "@/components/ui/Badge";

export function PriorityBadge({ priority }: { priority: string }) {
  const tone =
    priority === "critical" || priority === "high"
      ? "rose"
      : priority === "medium"
        ? "amber"
        : "emerald";

  return <Badge tone={tone}>{priority}</Badge>;
}
