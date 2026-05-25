import { Activity, BadgeCheck, Boxes, LineChart, Network } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

const iconMap = {
  competitor: Network,
  inventory: Boxes,
  trend: LineChart,
  coordinator: Activity
};

type AgentCardProps = {
  type: keyof typeof iconMap;
  title: string;
  description: string;
  status?: string;
  confidence?: number;
};

export function AgentCard({ type, title, description, status = "ready", confidence }: AgentCardProps) {
  const Icon = iconMap[type];

  return (
    <article className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-cyan-200">
          <Icon size={20} />
        </span>
        <Badge tone={status === "completed" ? "emerald" : status === "running" ? "cyan" : "slate"}>{status}</Badge>
      </div>
      <h3 className="mt-4 text-base font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
      <div className="mt-4 flex items-center gap-2 text-sm text-slate-300">
        <BadgeCheck size={16} className="text-emerald-300" />
        <span>{confidence ? `${Math.round(confidence * 100)}% confidence` : "Structured JSON output"}</span>
      </div>
    </article>
  );
}
