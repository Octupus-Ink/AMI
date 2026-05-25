import { CircleArrowOutUpRight } from "lucide-react";
import type { CoordinatorAgentOutput } from "@/lib/schemas/agents";
import { PriorityBadge } from "@/components/ui/PriorityBadge";

export function RecommendationList({
  recommendations
}: {
  recommendations: CoordinatorAgentOutput["recommendations"];
}) {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/60 p-5">
      <h2 className="text-lg font-semibold text-white">Coordinator recommendations</h2>
      <div className="mt-5 grid gap-4">
        {recommendations.map((recommendation) => (
          <article key={recommendation.title} className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <PriorityBadge priority={recommendation.priority} />
                  <span className="text-xs font-medium text-slate-400">{recommendation.sourceAgents.join(" + ")}</span>
                </div>
                <h3 className="mt-3 text-base font-semibold text-white">{recommendation.title}</h3>
              </div>
              <CircleArrowOutUpRight className="hidden text-cyan-300 sm:block" size={20} />
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-300">{recommendation.description}</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Business impact</p>
                <p className="mt-1 text-sm text-slate-300">{recommendation.businessImpact}</p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Suggested action</p>
                <p className="mt-1 text-sm text-slate-300">{recommendation.suggestedAction}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
