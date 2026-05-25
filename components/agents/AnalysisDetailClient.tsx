"use client";

import { ArrowLeft, BarChart3, Clock3, Database } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AgentOutputPanel } from "@/components/agents/AgentOutputPanel";
import { AgentTimeline } from "@/components/agents/AgentTimeline";
import { RecommendationList } from "@/components/agents/RecommendationList";
import { Badge } from "@/components/ui/Badge";
import type { AnalysisResult } from "@/lib/schemas/api";

export function AnalysisDetailClient({ id }: { id: string }) {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAnalysis() {
      try {
        const response = await fetch(`/api/analysis/${id}`);

        if (!response.ok) {
          const cached = window.localStorage.getItem(`ami:analysis:${id}`);

          if (cached) {
            setAnalysis(JSON.parse(cached) as AnalysisResult);
            return;
          }

          throw new Error("Analysis run was not found.");
        }

        const result = (await response.json()) as AnalysisResult;

        if (!cancelled) {
          setAnalysis(result);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load analysis.");
        }
      }
    }

    loadAnalysis();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const steps = useMemo(() => {
    const agentStatus = analysis?.analysisRun.agentStatus ?? {};

    return [
      {
        key: "competitor",
        label: "Competitor Intelligence Agent",
        description: analysis?.agents.competitor.summary ?? "Competitor findings pending.",
        status: agentStatus.competitor ?? "pending"
      },
      {
        key: "inventory",
        label: "Inventory Optimization Agent",
        description: analysis?.agents.inventory.summary ?? "Inventory findings pending.",
        status: agentStatus.inventory ?? "pending"
      },
      {
        key: "trend",
        label: "Trend Intelligence Agent",
        description: analysis?.agents.trend.summary ?? "Trend findings pending.",
        status: agentStatus.trend ?? "pending"
      },
      {
        key: "coordinator",
        label: "Coordinator Agent",
        description: analysis?.coordinator.executiveSummary ?? "Coordinator synthesis pending.",
        status: agentStatus.coordinator ?? "pending"
      }
    ];
  }, [analysis]);

  if (error) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-200">
          <ArrowLeft size={18} />
          Back to dashboard
        </Link>
        <div className="mt-6 rounded-lg border border-rose-300/30 bg-rose-300/10 p-6 text-rose-100">{error}</div>
      </main>
    );
  }

  if (!analysis) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-8 text-slate-300">Loading analysis...</div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-200">
        <ArrowLeft size={18} />
        Back to dashboard
      </Link>

      <section className="mt-6 rounded-lg border border-slate-800 bg-slate-950/60 p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={analysis.demoMode ? "amber" : "emerald"}>
                {analysis.demoMode ? "Demo fallback" : "Stored run"}
              </Badge>
              <Badge tone="cyan">{analysis.project.category}</Badge>
            </div>
            <h1 className="mt-4 text-3xl font-semibold text-white">{analysis.project.name}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{analysis.coordinator.executiveSummary}</p>
          </div>
          <div className="grid min-w-0 gap-3 sm:grid-cols-3 lg:w-[34rem]">
            <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
              <BarChart3 className="mb-3 text-cyan-300" size={20} />
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Health score</p>
              <p className="mt-1 text-2xl font-semibold text-white">{analysis.coordinator.marketplaceHealthScore}</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
              <Clock3 className="mb-3 text-amber-300" size={20} />
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
              <p className="mt-1 text-sm font-semibold text-white">{analysis.analysisRun.status}</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
              <Database className="mb-3 text-emerald-300" size={20} />
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Persistence</p>
              <p className="mt-1 text-sm font-semibold text-white">{analysis.dataSources.persistence}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6">
        <AgentTimeline steps={steps} />

        <RecommendationList recommendations={analysis.recommendations} />

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-5">
            <h2 className="text-lg font-semibold text-white">Next best actions</h2>
            <ul className="mt-4 space-y-3">
              {analysis.coordinator.nextBestActions.map((action) => (
                <li key={action} className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-sm text-slate-300">
                  {action}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-5">
            <h2 className="text-lg font-semibold text-white">Risk watchlist</h2>
            <ul className="mt-4 space-y-3">
              {analysis.coordinator.risks.map((risk) => (
                <li key={risk} className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-sm text-slate-300">
                  {risk}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <AgentOutputPanel title="Competitor Intelligence" output={analysis.agents.competitor} />
        <AgentOutputPanel title="Inventory Optimization" output={analysis.agents.inventory} />
        <AgentOutputPanel title="Trend Intelligence" output={analysis.agents.trend} />

        <details className="rounded-lg border border-slate-800 bg-slate-950/60 p-5">
          <summary className="cursor-pointer text-lg font-semibold text-white">Raw structured JSON</summary>
          <pre className="mt-4 max-h-[36rem] overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-300">
            {JSON.stringify(analysis, null, 2)}
          </pre>
        </details>
      </div>
    </main>
  );
}
