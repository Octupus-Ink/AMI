"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, CircleDashed, DatabaseZap, Radar, ShieldAlert } from "lucide-react";
import { BrightDataPill } from "@/components/ui/BrightDataPill";
import { StatusDot } from "@/components/ui/StatusDot";
import {
  MarketContextPayloadSchema,
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
  inventory: "pending",
  risk: "pending"
};

const latestActivity: Record<AssistantId, string> = {
  trend: "Waiting to review demand and social momentum signals.",
  competitor: "Waiting to compare pricing, availability, and market pressure.",
  supplier: "Waiting to compare supplier cost, delivery, and sourcing risk.",
  inventory: "Waiting to evaluate stock posture and operational context.",
  risk: "Waiting to review confidence, evidence gaps, and action readiness."
};

const sourceTypes: Record<AssistantId, string> = {
  trend: "Public market and social signals",
  competitor: "Marketplace comparison",
  supplier: "Supplier catalog snapshot",
  inventory: "Workspace inventory context",
  risk: "Assistant evidence synthesis"
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

function failedStartStates(message: string): Record<AssistantId, AssistantState> {
  const inventoryIssue = message.toLowerCase().includes("inventory");

  return {
    trend: inventoryIssue ? "skipped" : "failed",
    competitor: inventoryIssue ? "skipped" : "failed",
    supplier: inventoryIssue ? "skipped" : "failed",
    inventory: inventoryIssue ? "warning" : "failed",
    risk: inventoryIssue ? "skipped" : "failed"
  };
}

function logProcessing(message: string, details?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") {
    console.info(`[AMI Processing] ${message}`, details ?? "");
  }
}

export function ProcessingClient() {
  const router = useRouter();
  const abortRef = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState(12);
  const [assistantStates, setAssistantStates] = useState(initialStates);
  const [activity, setActivity] = useState(latestActivity);
  const [sourceStatus, setSourceStatus] = useState(processingMessages[0]);
  const [sourceMode, setSourceMode] = useState<SourceMode>("demo_snapshot");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();
    const timers: number[] = [];
    abortRef.current = controller;

    const stored = window.localStorage.getItem("ami.marketContext");

    if (!stored) {
      window.localStorage.setItem("ami.briefingError", "AMI briefing context was missing. Review the briefing and start again.");
      router.push("/market-context-setup");
      return () => {
        isActive = false;
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
        controller.abort();
      };
    }

    let context: MarketContextPayload;

    try {
      const parsedContext = MarketContextPayloadSchema.safeParse(JSON.parse(stored));

      if (!parsedContext.success) {
        throw new Error("Invalid market context");
      }

      context = parsedContext.data;
    } catch {
      window.localStorage.removeItem("ami.marketContext");
      window.localStorage.setItem("ami.briefingError", "AMI briefing context was invalid. Review the briefing and start again.");
      router.push("/market-context-setup");
      return () => {
        isActive = false;
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
        controller.abort();
      };
    }

    logProcessing("context loaded", {
      businessGoal: context.businessGoal,
      useInventoryContext: context.useInventoryContext
    });
    const inventoryCanBeLimited = !context.useInventoryContext && context.businessGoal === "discover_new_products";

    timers.push(
      window.setTimeout(() => {
        if (!isActive) {
          return;
        }

        setProgress(24);
        setAssistantStates((current) => ({ ...current, trend: "running" }));
        setActivity((current) => ({ ...current, trend: "Reading demand direction, seasonality, and trend velocity." }));
      }, 250),
      window.setTimeout(() => {
        if (!isActive) {
          return;
        }

        setProgress(42);
        setAssistantStates((current) => ({ ...current, trend: "completed", competitor: "running" }));
        setActivity((current) => ({ ...current, competitor: "Comparing competitor prices, discounts, and availability." }));
        setSourceStatus(processingMessages[1]);
      }, 850),
      window.setTimeout(() => {
        if (!isActive) {
          return;
        }

        setProgress(61);
        setAssistantStates((current) => ({ ...current, competitor: "completed", supplier: "running" }));
        setActivity((current) => ({ ...current, supplier: "Estimating unit cost, delivery windows, and sourcing risk." }));
        setSourceStatus(processingMessages[2]);
      }, 1400),
      window.setTimeout(() => {
        if (!isActive) {
          return;
        }

        setProgress(78);
        setAssistantStates((current) => ({
          ...current,
          supplier: "completed",
          inventory: inventoryCanBeLimited ? "limited" : "running",
          risk: "running"
        }));
        setActivity((current) => ({
          ...current,
          inventory: inventoryCanBeLimited
            ? "Using demo context because connected inventory is not required for this goal."
            : "Checking stock posture, margin context, and operational risk.",
          risk: "Reviewing confidence level, risk exposure, and evidence completeness."
        }));
        setSourceStatus(processingMessages[3]);
      }, 1950),
      window.setTimeout(() => {
        if (!isActive) {
          return;
        }

        setProgress(90);
        setSourceStatus(processingMessages[4]);
      }, 2400)
    );

    async function startAnalysis() {
      try {
        logProcessing("starting analysis");
        const response = await fetch("/api/analysis/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(context),
          signal: controller.signal
        });

        if (!isActive) {
          return;
        }

        logProcessing("analysis response status", { status: response.status, ok: response.ok });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({ error: "" }));
          const errorMessage = payload.error || "AMI could not complete this analysis. Return to Briefing and validate the context.";

          if (!isActive) {
            return;
          }

          timers.forEach((timer) => window.clearTimeout(timer));
          timers.length = 0;
          setProgress(100);
          setAssistantStates(failedStartStates(errorMessage));
          setActivity((current) => ({
            ...current,
            inventory: errorMessage.toLowerCase().includes("inventory")
              ? "Inventory is required for this business goal before AMI can continue."
              : "AMI stopped before inventory context could be resolved."
          }));
          setSourceStatus("Analysis stopped");
          setMessage(errorMessage);
          logProcessing("analysis failed", { status: response.status, reason: errorMessage });
          return;
        }

        const result = (await response.json()) as AnalysisResult;

        if (!isActive) {
          return;
        }

        const inventoryState = assistantStateFromResult(result.assistantStatus?.inventory);
        timers.forEach((timer) => window.clearTimeout(timer));
        timers.length = 0;
        setAssistantStates({
          trend: assistantStateFromResult(result.assistantStatus?.trend),
          competitor: assistantStateFromResult(result.assistantStatus?.competitor),
          supplier: assistantStateFromResult(result.assistantStatus?.supplier),
          inventory: inventoryCanBeLimited && inventoryState === "skipped" ? "limited" : inventoryState,
          risk: assistantStateFromResult(result.assistantStatus?.risk)
        });
        setActivity((current) => ({
          ...current,
          inventory:
            inventoryState === "warning"
              ? "Inventory context was requested but unavailable, so AMI continued without it."
              : inventoryState === "skipped"
                ? "Inventory Assistant was skipped for this optional inventory run."
                : "Inventory context resolved for this recommendation.",
          risk: "Risk and confidence review completed for the recommendation."
        }));
        setProgress(100);
        setSourceMode(result.sourceCollectionStatus?.mode ?? "demo_fallback");
        setSourceStatus(result.sourceCollectionStatus?.label ?? "Source collection completed");
        if (result.warnings?.length) {
          setMessage(result.warnings[0]);
        }
        window.localStorage.setItem("ami.latestAnalysis", JSON.stringify(result));
        timers.push(
          window.setTimeout(() => {
            if (isActive) {
              router.push(`/recommendations?runId=${result.analysisRunId}`);
            }
          }, 650)
        );
      } catch (error) {
        const isAbortError = error instanceof DOMException && error.name === "AbortError";

        if (!isActive || (controller.signal.aborted && isAbortError)) {
          return;
        }

        const errorMessage = error instanceof Error ? error.message : "AMI could not complete this analysis.";
        timers.forEach((timer) => window.clearTimeout(timer));
        timers.length = 0;
        setProgress(100);
        setAssistantStates(failedStartStates(errorMessage));
        setSourceStatus("Analysis failed");
        setMessage(errorMessage);
        logProcessing("analysis failed", { reason: errorMessage });
      }
    }

    startAnalysis();

    return () => {
      isActive = false;
      timers.forEach((timer) => window.clearTimeout(timer));
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
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

        <div className="mt-5 flex flex-col gap-3">
          {VisibleAssistants.map((assistant) => {
            const state = assistantStates[assistant.id];

            return (
              <div key={assistant.id} className="flex flex-col gap-3 border-b border-slate-200 py-4 last:border-b-0 sm:flex-row sm:items-start">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span className="mt-0.5">
                    {state === "completed" ? (
                      <CheckCircle2 className="text-emerald-600" size={20} />
                    ) : state === "warning" || state === "failed" ? (
                      <ShieldAlert className="text-amber-600" size={20} />
                    ) : (
                      <CircleDashed className="text-teal-700" size={20} />
                    )}
                  </span>
                  <div>
                    <p className="font-semibold text-slate-950">{assistant.name}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{assistant.role}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{activity[assistant.id]}</p>
                  </div>
                </div>
                <div className="flex min-w-48 flex-wrap items-center gap-3 sm:justify-end">
                  <span className="inline-flex items-center gap-2 text-sm font-semibold capitalize text-slate-700">
                    <StatusDot tone={dotTone(state)} />
                    {state}
                  </span>
                  <span className="text-xs font-semibold uppercase text-slate-500">{sourceTypes[assistant.id]}</span>
                </div>
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
