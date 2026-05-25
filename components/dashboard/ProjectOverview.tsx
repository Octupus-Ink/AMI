import { Globe2, PackageCheck, Target } from "lucide-react";
import type { MarketplaceProject } from "@/lib/schemas/api";
import { Badge } from "@/components/ui/Badge";

export function ProjectOverview({ project, demoMode }: { project: MarketplaceProject; demoMode: boolean }) {
  const productCount = project.products.length;

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/60 p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={demoMode ? "amber" : "emerald"}>{demoMode ? "Demo mode" : "Live persistence"}</Badge>
            <Badge tone="cyan">{project.category}</Badge>
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-white sm:text-3xl">{project.name}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Marketplace project targeting {project.targetMarket} with {productCount} tracked products and{" "}
            {project.trackedCompetitors.length} competitors.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
          <Target className="mb-3 text-cyan-300" size={20} />
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Market</p>
          <p className="mt-1 text-sm font-semibold text-white">{project.targetMarket}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
          <Globe2 className="mb-3 text-amber-300" size={20} />
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Competitors</p>
          <p className="mt-1 text-sm font-semibold text-white">{project.trackedCompetitors.join(", ")}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
          <PackageCheck className="mb-3 text-emerald-300" size={20} />
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Products</p>
          <p className="mt-1 text-sm font-semibold text-white">{productCount} active SKUs</p>
        </div>
      </div>
    </section>
  );
}
