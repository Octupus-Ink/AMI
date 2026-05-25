"use client";

import { Activity, AlertTriangle, Database, Play, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AgentTimeline } from "@/components/agents/AgentTimeline";
import { AgentCard } from "@/components/dashboard/AgentCard";
import { ProjectOverview } from "@/components/dashboard/ProjectOverview";
import { RecentRuns } from "@/components/dashboard/RecentRuns";
import { Badge } from "@/components/ui/Badge";
import type { AnalysisResult, MarketplaceProject, RecentRun } from "@/lib/schemas/api";

type DemoPayload = {
  project: MarketplaceProject;
  recentRuns: RecentRun[];
  demoMode: boolean;
  databaseAvailable: boolean;
  missingEnvVars: string[];
};

const defaultSteps = [
  {
    key: "competitor",
    label: "Competitor Intelligence Agent",
    description: "Reads marketplace pricing and availability signals.",
    status: "pending"
  },
  {
    key: "inventory",
    label: "Inventory Optimization Agent",
    description: "Checks stock posture, velocity, and margin risk.",
    status: "pending"
  },
  {
    key: "trend",
    label: "Trend Intelligence Agent",
    description: "Reviews demand direction and seasonality signals.",
    status: "pending"
  },
  {
    key: "coordinator",
    label: "Coordinator Agent",
    description: "Synthesizes findings into business recommendations.",
    status: "pending"
  }
];

export function DashboardClient() {
  const router = useRouter();
  const [payload, setPayload] = useState<DemoPayload | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(-1);

  useEffect(() => {
    fetch("/api/demo")
      .then((response) => response.json())
      .then(setPayload)
      .catch(() => {
        setRunError("Unable to load demo project data.");
      });
  }, []);

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    const timer = window.setInterval(() => {
      setStepIndex((current) => Math.min(current + 1, defaultSteps.length - 1));
    }, 900);

    return () => window.clearInterval(timer);
  }, [isRunning]);

  const steps = useMemo(
    () =>
      defaultSteps.map((step, index) => ({
        ...step,
        status: isRunning
          ? index < stepIndex
            ? "completed"
            : index === stepIndex
              ? "running"
              : "pending"
          : step.status
      })),
    [isRunning, stepIndex]
  );

  async function runAnalysis() {
    if (!payload?.project) {
      return;
    }

    setIsRunning(true);
    setStepIndex(0);
    setRunError(null);

    try {
      const response = await fetch("/api/analysis/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ project: payload.project })
      });

      if (!response.ok) {
        throw new Error("Analysis route returned an error.");
      }

      const result = (await response.json()) as AnalysisResult;
      window.localStorage.setItem(`ami:analysis:${result.id}`, JSON.stringify(result));
      window.localStorage.setItem("ami:last-analysis", result.id);
      router.push(`/analysis/${result.id}`);
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Analysis failed.");
      setIsRunning(false);
      setStepIndex(-1);
    }
  }

  if (!payload) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-8 text-slate-300">Loading dashboard...</div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="cyan">Marketplace command center</Badge>
            {payload.demoMode ? <Badge tone="amber">Fallback data active</Badge> : <Badge tone="emerald">Live mode</Badge>}
          </div>
          <h1 className="mt-4 text-3xl font-semibold text-white">Dashboard</h1>
        </div>
        <button
          type="button"
          onClick={runAnalysis}
          disabled={isRunning}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
        >
          {isRunning ? <Activity size={18} className="animate-pulse" /> : <Play size={18} />}
          {isRunning ? "Agents running" : "Run Marketplace Analysis"}
        </button>
      </div>

      {runError ? (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-rose-300/30 bg-rose-300/10 p-4 text-sm text-rose-100">
          <AlertTriangle className="mt-0.5 shrink-0" size={18} />
          <p>{runError}</p>
        </div>
      ) : null}

      <div className="grid gap-6">
        <ProjectOverview project={payload.project} demoMode={payload.demoMode} />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <AgentCard
            type="competitor"
            title="Competitor Intelligence"
            description="Pricing, stock status, delivery pressure, and discount detection."
            status={isRunning && stepIndex === 0 ? "running" : "ready"}
          />
          <AgentCard
            type="inventory"
            title="Inventory Optimization"
            description="Stock position, velocity, margin estimate, and operational risk."
            status={isRunning && stepIndex === 1 ? "running" : "ready"}
          />
          <AgentCard
            type="trend"
            title="Trend Intelligence"
            description="Market demand signals, seasonality, and product trend score."
            status={isRunning && stepIndex === 2 ? "running" : "ready"}
          />
          <AgentCard
            type="coordinator"
            title="Coordinator"
            description="Cross-agent synthesis into final marketplace recommendations."
            status={isRunning && stepIndex === 3 ? "running" : "ready"}
          />
        </section>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <AgentTimeline steps={steps} />
          <section className="rounded-lg border border-slate-800 bg-slate-950/60 p-5">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-white">Runtime mode</h2>
              <Badge tone={payload.databaseAvailable ? "emerald" : "amber"}>
                {payload.databaseAvailable ? "MongoDB connected" : "MongoDB fallback"}
              </Badge>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
                <Database className="mb-3 text-emerald-300" size={20} />
                <p className="text-sm font-semibold text-white">Shared intelligence layer</p>
                <p className="mt-1 text-sm text-slate-400">
                  {payload.databaseAvailable
                    ? "Historical runs will be loaded from MongoDB."
                    : "Historical runs use demo memory until MongoDB is configured."}
                </p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
                <Sparkles className="mb-3 text-amber-300" size={20} />
                <p className="text-sm font-semibold text-white">Missing environment variables</p>
                <p className="mt-1 text-sm text-slate-400">
                  {payload.missingEnvVars.length ? payload.missingEnvVars.join(", ") : "None"}
                </p>
              </div>
            </div>
          </section>
        </div>

        <RecentRuns runs={payload.recentRuns} />
      </div>
    </main>
  );
}
