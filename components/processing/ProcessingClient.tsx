"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, CircleDashed, DatabaseZap, Radar, ShieldAlert } from "lucide-react";
import { BrightDataPill } from "@/components/ui/BrightDataPill";
import { StatusDot } from "@/components/ui/StatusDot";
import {
  VisibleAssistants,
  type AnalysisResult,
  type AssistantId,
  type MarketContextPayload,
  type SourceMode
} from "@/lib/schemas/ami";

type AssistantState = "pending" | "running" | "completed" | "warning" | "failed" | "skipped" | "limited";

const initialStates: Record<AssistantId, AssistantState> = {
  trend: "pending",
  competitor: "pending",
  supplier: "pending",
  inventory: "pending"
};

const latestActivity: Record<AssistantId, string> = {
  trend: "Waiting to review demand and social momentum signals.",
  competitor: "Waiting to compare pricing, availability, and market pressure.",
  supplier: "Waiting to compare supplier cost, delivery, and sourcing risk.",
  inventory: "Waiting to evaluate stock posture and operational context."
};

const sourceTypes: Record<AssistantId, string> = {
  trend: "Public market and social signals",
  competitor: "Marketplace comparison",
  supplier: "Supplier catalog snapshot",
  inventory: "Workspace inventory context"
};

const processingMessages = [
  "Collecting marketplace and demand signals",
  "Comparing supplier options",
  "Evaluating inventory posture",
  "Resolving assistant recommendations",
  "Preparing AMI Strategy"
];

function formatMode(mode: SourceMode) {
  return mode
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function assistantStateFromResult(status: string | undefined): AssistantState {
  if (status === "completed" || status === "warning" || status === "failed" || status === "skipped" || status === "running") {
    return status;
  }

  return "completed";
}

function dotTone(state: AssistantState): "teal" | "amber" | "red" | "green" | "slate" {
  if (state === "completed") {
    return "green";
  }

  if (state === "running") {
    return "teal";
  }

  if (state === "warning" || state === "limited") {
    return "amber";
  }

  if (state === "failed") {
    return "red";
  }

  return "slate";
}

export function ProcessingClient() {
  const router = useRouter();
  const started = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState(12);
  const [assistantStates, setAssistantStates] = useState(initialStates);
  const [activity, setActivity] = useState(latestActivity);
  const [sourceStatus, setSourceStatus] = useState(processingMessages[0]);
  const [sourceMode, setSourceMode] = useState<SourceMode>("demo_snapshot");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (started.current) {
      return;
    }

    started.current = true;
    const stored = window.localStorage.getItem("ami.marketContext");

    if (!stored) {
      router.push("/market-context-setup");
      return;
    }

    const context = JSON.parse(stored) as MarketContextPayload;
    const inventoryCanBeLimited = !context.useInventoryContext && context.businessGoal === "discover_new_products";
    const controller = new AbortController();
    abortRef.current = controller;

    const timers = [
      window.setTimeout(() => {
        setProgress(24);
        setAssistantStates((current) => ({ ...current, trend: "running" }));
        setActivity((current) => ({ ...current, trend: "Reading demand direction, seasonality, and trend velocity." }));
      }, 250),
      window.setTimeout(() => {
        setProgress(42);
        setAssistantStates((current) => ({ ...current, trend: "completed", competitor: "running" }));
        setActivity((current) => ({ ...current, competitor: "Comparing competitor prices, discounts, and availability." }));
        setSourceStatus(processingMessages[1]);
      }, 850),
      window.setTimeout(() => {
        setProgress(61);
        setAssistantStates((current) => ({ ...current, competitor: "completed", supplier: "running" }));
        setActivity((current) => ({ ...current, supplier: "Estimating unit cost, delivery windows, and sourcing risk." }));
        setSourceStatus(processingMessages[2]);
      }, 1400),
      window.setTimeout(() => {
        setProgress(78);
        setAssistantStates((current) => ({
          ...current,
          supplier: "completed",
          inventory: inventoryCanBeLimited ? "limited" : "running"
        }));
        setActivity((current) => ({
          ...current,
          inventory: inventoryCanBeLimited
            ? "Using demo context because connected inventory is not required for this goal."
            : "Checking stock posture, margin context, and operational risk."
        }));
        setSourceStatus(processingMessages[3]);
      }, 1950),
      window.setTimeout(() => {
        setProgress(90);
        setSourceStatus(processingMessages[4]);
      }, 2400)
    ];

    async function startAnalysis() {
      try {
        const response = await fetch("/api/analysis/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(context),
          signal: controller.signal
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({ error: "" }));
          setProgress(100);
          setAssistantStates((current) => ({ ...current, inventory: "failed" }));
          setSourceStatus("Analysis stopped");
          setMessage(payload.error || "AMI could not complete this analysis. Return to Briefing and validate the context.");
          return;
        }

        const result = (await response.json()) as AnalysisResult;
        const inventoryState = assistantStateFromResult(result.assistantStatus?.inventory);
        setAssistantStates({
          trend: assistantStateFromResult(result.assistantStatus?.trend),
          competitor: assistantStateFromResult(result.assistantStatus?.competitor),
          supplier: assistantStateFromResult(result.assistantStatus?.supplier),
          inventory: inventoryCanBeLimited && inventoryState === "skipped" ? "limited" : inventoryState
        });
        setActivity((current) => ({
          ...current,
          inventory:
            inventoryState === "warning"
              ? "Inventory context was requested but unavailable, so AMI continued without it."
              : inventoryState === "skipped"
                ? "Inventory Assistant was skipped for this optional inventory run."
                : "Inventory context resolved for this recommendation."
        }));
        setProgress(100);
        setSourceMode(result.sourceCollectionStatus?.mode ?? "demo_fallback");
        setSourceStatus(result.sourceCollectionStatus?.label ?? "Source collection completed");
        if (result.warnings?.length) {
          setMessage(result.warnings[0]);
        }
        window.localStorage.setItem("ami.latestAnalysis", JSON.stringify(result));
        window.setTimeout(() => router.push(`/recommendations?runId=${result.analysisRunId}`), 650);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setMessage(error instanceof Error ? error.message : "AMI could not complete this analysis.");
      }
    }

    startAnalysis();

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      controller.abort();
    };
  }, [router]);

  function cancelAnalysis() {
    abortRef.current?.abort();
    window.localStorage.removeItem("ami.latestAnalysis");
    router.push("/market-context-setup");
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={cancelAnalysis}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-teal-300 hover:text-teal-800"
        >
          <ArrowLeft size={17} />
          Back to briefing
        </button>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <BrightDataPill />
            <h1 className="mt-4 text-3xl font-semibold text-slate-950">AMI is coordinating the assistants</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              AMI is reviewing the market context, resolving assistant signals, and preparing the recommendation layer.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
            <p className="text-xs font-semibold uppercase text-slate-500">Source mode</p>
            <p className="mt-1 font-semibold text-slate-950">{formatMode(sourceMode)}</p>
          </div>
        </div>

        <div className="mt-7 rounded-lg border border-slate-200 bg-slate-50 p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Radar className="text-teal-700" size={24} />
              <div>
                <p className="font-semibold text-slate-950">AMI status</p>
                <p className="text-sm text-slate-600">{sourceStatus}</p>
              </div>
            </div>
            <p className="text-sm font-semibold text-teal-800">{progress}%</p>
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full bg-teal-600 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-4">
          {VisibleAssistants.map((assistant) => {
            const state = assistantStates[assistant.id];

            return (
              <div key={assistant.id} className="rounded-lg border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-slate-950">{assistant.name}</p>
                  {state === "completed" ? (
                    <CheckCircle2 className="text-emerald-600" size={20} />
                  ) : state === "warning" || state === "failed" ? (
                    <ShieldAlert className="text-amber-600" size={20} />
                  ) : (
                    <CircleDashed className="text-teal-700" size={20} />
                  )}
                </div>
                <p className="mt-2 min-h-20 text-sm leading-6 text-slate-600">{assistant.role}</p>
                <div className="mt-4 flex items-center gap-2 text-sm font-semibold capitalize text-slate-700">
                  <StatusDot tone={dotTone(state)} />
                  {state}
                </div>
                <p className="mt-3 text-xs font-semibold uppercase text-slate-500">Latest activity</p>
                <p className="mt-1 text-sm leading-6 text-slate-700">{activity[assistant.id]}</p>
                <p className="mt-3 text-xs font-semibold uppercase text-slate-500">Source type used</p>
                <p className="mt-1 text-sm text-slate-700">{sourceTypes[assistant.id]}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-5 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-3">
            <DatabaseZap className="text-blue-800" size={20} />
            <p className="text-sm font-semibold text-blue-950">Data source state: {sourceStatus}</p>
          </div>
        </div>

        {message && <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{message}</p>}
      </section>
    </main>
  );
}
