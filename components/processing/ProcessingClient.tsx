"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, CircleDashed, DatabaseZap, Radar, ShieldAlert } from "lucide-react";
import { BrightDataPill } from "@/components/ui/BrightDataPill";
import { StatusDot } from "@/components/ui/StatusDot";
import { sanitizeEvidenceSnippet } from "@/lib/analysis/source-state";
import { amiDiagLog, briefingDiagFields, createDiagRequestId } from "@/lib/diagnostics/ami-diag";
import {
  MarketContextPayloadSchema,
  VisibleAssistants,
  type AnalysisResult,
  type AssistantId,
  type MarketContextPayload,
  type SourceMode
} from "@/lib/schemas/ami";

type AssistantState = "pending" | "running" | "completed" | "warning" | "failed" | "skipped" | "fallback" | "limited";

const MIN_ORCHESTRATION_VISIBLE_MS = 3500;
const PREPARING_REDIRECT_DELAY_MS = 650;

function assistantSeedActivity(id: AssistantId) {
  const copy: Record<AssistantId, string> = {
    orchestrator: "Waiting to build the goal-specific strategy and resolve final decision rules.",
    inventory: "Waiting to evaluate stock posture, cannibalization, restock need, and operational context.",
    trend: "Waiting to review demand and trend momentum.",
    competitor: "Waiting to compare pricing, availability, and market pressure.",
    supplier: "Waiting to compare supplier cost, delivery, availability, and sourcing risk."
  };

  return copy[id];
}

function assistantSourceType(id: AssistantId) {
  const copy: Record<AssistantId, string> = {
    orchestrator: "Goal strategy and decision resolution",
    inventory: "Inventory and operational context",
    trend: "Demand and trend KPIs",
    competitor: "Marketplace comparison",
    supplier: "Supplier evidence"
  };

  return copy[id];
}

const initialStates = VisibleAssistants.reduce(
  (states, assistant) => ({ ...states, [assistant.id]: "pending" as AssistantState }),
  {} as Record<AssistantId, AssistantState>
);

const latestActivity = VisibleAssistants.reduce(
  (activity, assistant) => ({ ...activity, [assistant.id]: assistantSeedActivity(assistant.id) }),
  {} as Record<AssistantId, string>
);

const processingMessages = [
  "Checking live provider",
  "Collecting live marketplace data",
  "Normalizing provider data",
  "Resolving assistant recommendations",
  "Preparing AMI Strategy"
];

type StartRequestEntry = {
  requestId: string;
  startedAt: string;
  controller: AbortController;
  promise: Promise<AnalysisResult>;
};

const startRequestCache = new Map<string, StartRequestEntry>();

function analysisLockKey(fingerprint: string) {
  return `ami.analysis.inFlight.${fingerprint}`;
}

function formatMode(mode: SourceMode | string) {
  if (mode === "pending") {
    return "Pending";
  }

  if (mode === "live") {
    return "Live Bright Data sources";
  }

  if (mode === "demo") {
    return "Demo";
  }

  if (mode === "fallback") {
    return "Fallback";
  }

  if (mode === "fallback_snapshot") {
    return "Fallback snapshot";
  }

  if (mode === "demo_seed") {
    return "Demo seed";
  }

  if (mode === "demo_fallback" || mode === "demo_snapshot") {
    return "Demo seed";
  }

  if (mode === "mixed") {
    return "Mixed live + fallback";
  }

  if (mode === "error" || mode === "not_configured") {
    return "Provider failed";
  }

  return mode
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function assistantStateFromResult(status: string | undefined): AssistantState {
  if (
    status === "completed" ||
    status === "warning" ||
    status === "failed" ||
    status === "skipped" ||
    status === "running" ||
    status === "fallback"
  ) {
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

  if (state === "warning" || state === "limited" || state === "fallback") {
    return "amber";
  }

  if (state === "failed") {
    return "red";
  }

  return "slate";
}

function failedStartStates(message: string): Record<AssistantId, AssistantState> {
  const inventoryIssue = message.toLowerCase().includes("inventory");

  return VisibleAssistants.reduce(
    (states, assistant) => ({
      ...states,
      [assistant.id]: inventoryIssue ? (assistant.id === "inventory" ? "warning" : "skipped") : "failed"
    }),
    {} as Record<AssistantId, AssistantState>
  );
}

function logProcessing(message: string, details?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") {
    console.info(`[AMI Processing] ${message}`, details ?? "");
  }
}

function safeStatusMessage(value: string) {
  return sanitizeEvidenceSnippet(value, 360) ?? "Provider status unavailable";
}

export function ProcessingClient() {
  const router = useRouter();
  const abortRef = useRef<AbortController | null>(null);
  const activeFingerprintRef = useRef<string | null>(null);
  const [progress, setProgress] = useState(12);
  const [assistantStates, setAssistantStates] = useState(initialStates);
  const [activity, setActivity] = useState(latestActivity);
  const [sourceStatus, setSourceStatus] = useState(processingMessages[0]);
  const [sourceMode, setSourceMode] = useState<SourceMode>("pending");
  const [message, setMessage] = useState("");
  const [isPreparingStrategy, setIsPreparingStrategy] = useState(false);
  const [latestResult, setLatestResult] = useState<AnalysisResult | null>(null);

  useEffect(() => {
    let isActive = true;
    let pollCount = 0;
    const controller = new AbortController();
    const timers: number[] = [];
    const orchestrationStartedAt = Date.now();
    const effectRequestId = createDiagRequestId("processing_effect");
    const effectStartedAt = new Date().toISOString();
    abortRef.current = controller;
    amiDiagLog("processing_effect_start", {
      requestId: effectRequestId,
      route: "/processing",
      startedAt: effectStartedAt
    });

    const stored = window.localStorage.getItem("ami.marketContext");

    if (!stored) {
      amiDiagLog("processing_context_missing", {
        requestId: effectRequestId,
        route: "/processing"
      });
      window.localStorage.setItem("ami.briefingError", "AMI briefing context was missing. Review the briefing and start again.");
      router.push("/market-context-setup");
      return () => {
        amiDiagLog("processing_cleanup_called", {
          requestId: effectRequestId,
          route: "/processing",
          abortReason: "missing_context_cleanup"
        });
        isActive = false;
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
        amiDiagLog("processing_cleanup_abort_called", {
          requestId: effectRequestId,
          route: "/processing",
          abortReason: "missing_context_cleanup"
        });
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
      amiDiagLog("processing_context_invalid", {
        requestId: effectRequestId,
        route: "/processing"
      });
      window.localStorage.removeItem("ami.marketContext");
      window.localStorage.setItem("ami.briefingError", "AMI briefing context was invalid. Review the briefing and start again.");
      router.push("/market-context-setup");
      return () => {
        amiDiagLog("processing_cleanup_called", {
          requestId: effectRequestId,
          route: "/processing",
          abortReason: "invalid_context_cleanup"
        });
        isActive = false;
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
        amiDiagLog("processing_cleanup_abort_called", {
          requestId: effectRequestId,
          route: "/processing",
          abortReason: "invalid_context_cleanup"
        });
        controller.abort();
      };
    }

    const diagContext = briefingDiagFields(context);
    const lockKey = analysisLockKey(diagContext.briefingFingerprint);
    activeFingerprintRef.current = diagContext.briefingFingerprint;
    const existingLock = window.sessionStorage.getItem(lockKey);

    amiDiagLog("processing_context_loaded", {
      requestId: effectRequestId,
      route: "/processing",
      ...diagContext,
      isDuplicateStart: Boolean(existingLock)
    });
    logProcessing("context loaded", {
      businessGoal: context.businessGoal,
      useInventoryContext: context.useInventoryContext
    });
    const inventoryCanBeLimited = !context.useInventoryContext && context.businessGoal === "discover_new_products";

    VisibleAssistants.forEach((assistant, index) => {
      timers.push(
        window.setTimeout(() => {
          if (!isActive) {
            return;
          }

          setProgress(Math.min(88, 20 + index * 11));
          setAssistantStates((current) => ({
            ...current,
            [assistant.id]: assistant.id === "inventory" && inventoryCanBeLimited ? "limited" : "running"
          }));
          setActivity((current) => ({
            ...current,
            [assistant.id]:
              assistant.id === "inventory" && inventoryCanBeLimited
                ? "Inventory context is optional for this discovery briefing."
                : assistantSeedActivity(assistant.id).replace("Waiting to", "Running")
          }));
          setSourceStatus(processingMessages[Math.min(index, processingMessages.length - 1)]);
        }, 250 + index * 430)
      );
    });

    function applyAnalysisState(result: AnalysisResult) {
      const statusRows =
        result.agentStatus?.length
          ? result.agentStatus
          : VisibleAssistants.map((assistant) => ({
              agentType: assistant.id,
              status: result.assistantStatus?.[assistant.id] ?? "pending",
              latestActivity: assistantSeedActivity(assistant.id)
            }));

      setAssistantStates(
        statusRows.reduce(
          (states, row) => ({
            ...states,
            [row.agentType]:
              row.agentType === "inventory" && inventoryCanBeLimited && row.status === "skipped"
                ? "limited"
                : assistantStateFromResult(row.status)
          }),
          {} as Record<AssistantId, AssistantState>
        )
      );
      setActivity((current) => ({
        ...current,
        ...Object.fromEntries(statusRows.map((row) => [row.agentType, row.latestActivity ?? assistantSeedActivity(row.agentType)]))
      }));
      setSourceMode(result.sourceMode ?? result.sourceCollectionStatus?.mode ?? "pending");
      setSourceStatus(result.sourceCollectionStatus?.label ?? result.sourceCollectionStatus?.sourceLabel ?? "Source collection completed");
      setLatestResult(result);

      if (result.status === "metrics_ready") {
        setProgress(62);
      } else if (result.status === "agents_running" || result.status === "synthesizing" || result.status === "generating_verdict") {
        setProgress(86);
      } else {
        setProgress(100);
      }

      if (result.warnings?.length) {
        setMessage(safeStatusMessage(result.warnings[0]));
      }
    }

    function isTerminal(result: AnalysisResult) {
      return result.status === "completed" || result.status === "completed_with_fallback" || result.status === "failed";
    }

    function redirectWhenReady(result: AnalysisResult) {
      setIsPreparingStrategy(true);
      window.localStorage.setItem("ami.latestAnalysis", JSON.stringify(result));
      window.sessionStorage.removeItem(lockKey);
      startRequestCache.delete(diagContext.briefingFingerprint);
      amiDiagLog("processing_latest_analysis_write", {
        requestId: effectRequestId,
        analysisRunId: result.analysisRunId,
        route: "/processing",
        ...diagContext
      });
      const visibleForMs = Date.now() - orchestrationStartedAt;
      const redirectDelayMs =
        visibleForMs >= MIN_ORCHESTRATION_VISIBLE_MS
          ? PREPARING_REDIRECT_DELAY_MS
          : MIN_ORCHESTRATION_VISIBLE_MS - visibleForMs;
      amiDiagLog("processing_redirect_scheduled", {
        requestId: effectRequestId,
        analysisRunId: result.analysisRunId,
        route: "/processing",
        durationMs: Math.round(visibleForMs)
      });
      timers.push(
        window.setTimeout(() => {
          if (isActive) {
            amiDiagLog("processing_redirect_executed", {
              requestId: effectRequestId,
              analysisRunId: result.analysisRunId,
              route: `/recommendations?runId=${result.analysisRunId}`
            });
            router.push(`/recommendations?runId=${result.analysisRunId}`);
          }
        }, redirectDelayMs)
      );
    }

    async function pollAnalysis(analysisRunId: string) {
      amiDiagLog("processing_polling_started", {
        requestId: effectRequestId,
        analysisRunId,
        route: "/processing",
        pollCount
      });
      const pollTimer = window.setTimeout(async () => {
        if (!isActive) {
          return;
        }

        try {
          pollCount += 1;
          const response = await fetch(`/api/analysis/${analysisRunId}`, { signal: controller.signal });
          amiDiagLog("processing_polling_response", {
            requestId: effectRequestId,
            analysisRunId,
            route: `/api/analysis/${analysisRunId}`,
            responseStatus: response.status,
            ok: response.ok,
            pollCount
          });

          if (!response.ok) {
            throw new Error("AMI could not retrieve the latest analysis status.");
          }

          const result = (await response.json()) as AnalysisResult;

          if (!isActive) {
            return;
          }

          applyAnalysisState(result);
          window.localStorage.setItem("ami.latestAnalysis", JSON.stringify(result));

          if (isTerminal(result)) {
            amiDiagLog("processing_terminal_status_detected", {
              requestId: effectRequestId,
              analysisRunId,
              runStatus: result.status,
              sourceMode: result.sourceMode,
              usedFallback: result.fallbackUsed
            });
            redirectWhenReady(result);
            return;
          }

          pollAnalysis(analysisRunId);
        } catch (error) {
          if (!isActive) {
            return;
          }

          const errorMessage = error instanceof Error ? error.message : "AMI polling failed.";
          setMessage(safeStatusMessage(errorMessage));
          logProcessing("analysis polling failed", { reason: errorMessage });
        }
      }, 1200);

      timers.push(pollTimer);
    }

    async function startAnalysis() {
      const cachedEntry = startRequestCache.get(diagContext.briefingFingerprint);
      const startRequestId = cachedEntry?.requestId ?? createDiagRequestId("analysis_start");
      const startedAt = cachedEntry?.startedAt ?? new Date().toISOString();
      const duplicateLock = window.sessionStorage.getItem(lockKey);
      const isDuplicateStart = Boolean(cachedEntry || duplicateLock);

      let entry = cachedEntry;

      if (!entry) {
        const startController = new AbortController();
        amiDiagLog("processing_fetch_started", {
          requestId: startRequestId,
          route: "/api/analysis/start",
          startedAt,
          ...diagContext,
          isDuplicateStart
        });
        const startPromise = fetch("/api/analysis/start", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-ami-request-id": startRequestId,
            "x-ami-briefing-fingerprint": diagContext.briefingFingerprint
          },
          body: JSON.stringify(context),
          signal: startController.signal
        }).then(async (response) => {
          logProcessing("analysis response status", { status: response.status, ok: response.ok });
          amiDiagLog("processing_fetch_response", {
            requestId: startRequestId,
            route: "/api/analysis/start",
            responseStatus: response.status,
            ok: response.ok,
            durationMs: Date.now() - new Date(startedAt).getTime()
          });

          if (!response.ok) {
            const payload = await response.json().catch(() => ({ error: "" }));
            throw new Error(payload.error || "AMI could not complete this analysis. Return to Briefing and validate the context.");
          }

          return (await response.json()) as AnalysisResult;
        });

        entry = {
          requestId: startRequestId,
          startedAt,
          controller: startController,
          promise: startPromise
        };
        startRequestCache.set(diagContext.briefingFingerprint, entry);
        window.sessionStorage.setItem(lockKey, JSON.stringify({
          requestId: startRequestId,
          startedAt
        }));
      }

      try {
        amiDiagLog("processing_start_analysis_called", {
          requestId: startRequestId,
          route: "/processing",
          startedAt,
          ...diagContext,
          isDuplicateStart
        });
        logProcessing("starting analysis");

        if (cachedEntry) {
          amiDiagLog("processing_duplicate_start_blocked", {
            requestId: startRequestId,
            route: "/processing",
            ...diagContext,
            isDuplicateStart: true
          });
          amiDiagLog("processing_start_cache_reused", {
            requestId: startRequestId,
            route: "/processing",
            ...diagContext,
            isDuplicateStart: true
          });
        }

        const result = await entry.promise;

        if (!isActive) {
          return;
        }

        timers.forEach((timer) => window.clearTimeout(timer));
        timers.length = 0;
        applyAnalysisState(result);
        window.localStorage.setItem("ami.latestAnalysis", JSON.stringify(result));
        window.sessionStorage.setItem(lockKey, JSON.stringify({
          requestId: startRequestId,
          analysisRunId: result.analysisRunId,
          startedAt,
          completedAt: new Date().toISOString()
        }));
        amiDiagLog("processing_current_analysis_run", {
          requestId: startRequestId,
          analysisRunId: result.analysisRunId,
          runStatus: result.status,
          sourceMode: result.sourceMode,
          usedFallback: result.fallbackUsed,
          dataQualityStatus: result.dataQualitySummary?.status
        });

        if (isTerminal(result)) {
          redirectWhenReady(result);
          return;
        }

        pollAnalysis(result.analysisRunId);
      } catch (error) {
        const isAbortError = error instanceof DOMException && error.name === "AbortError";

        if (isAbortError || entry.controller.signal.aborted) {
          amiDiagLog("processing_fetch_aborted", {
            requestId: startRequestId,
            route: "/api/analysis/start",
            abortReason: entry.controller.signal.aborted ? "controller_abort" : "abort_error",
            durationMs: Date.now() - new Date(startedAt).getTime()
          });
        }

        if (!isActive || (entry.controller.signal.aborted && isAbortError)) {
          return;
        }

        const errorMessage = error instanceof Error ? error.message : "AMI could not complete this analysis.";
        window.sessionStorage.removeItem(lockKey);
        startRequestCache.delete(diagContext.briefingFingerprint);
        timers.forEach((timer) => window.clearTimeout(timer));
        timers.length = 0;
        setProgress(100);
        setAssistantStates(failedStartStates(errorMessage));
        setSourceStatus("Analysis failed");
        setMessage(safeStatusMessage(errorMessage));
        logProcessing("analysis failed", { reason: errorMessage });
        amiDiagLog("processing_start_failed", {
          requestId: startRequestId,
          route: "/api/analysis/start",
          errorMessage
        });
      }
    }

    startAnalysis();

    return () => {
      amiDiagLog("processing_cleanup_called", {
        requestId: effectRequestId,
        route: "/processing",
        abortReason: "effect_cleanup"
      });
      isActive = false;
      timers.forEach((timer) => window.clearTimeout(timer));
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      amiDiagLog("processing_cleanup_abort_called", {
        requestId: effectRequestId,
        route: "/processing",
        abortReason: "effect_cleanup"
      });
      controller.abort();
    };
  }, [router]);

  function cancelAnalysis() {
    const fingerprint = activeFingerprintRef.current;

    amiDiagLog("processing_cancel_clicked", {
      requestId: createDiagRequestId("processing_cancel"),
      route: "/processing",
      abortReason: "user_cancel"
    });
    if (fingerprint) {
      startRequestCache.get(fingerprint)?.controller.abort();
      startRequestCache.delete(fingerprint);
      window.sessionStorage.removeItem(analysisLockKey(fingerprint));
    }
    abortRef.current?.abort();
    window.localStorage.removeItem("ami.latestAnalysis");
    router.push("/market-context-setup");
  }

  const displayAssistants = latestResult?.agentStatus?.length
    ? [...latestResult.agentStatus]
        .sort((a, b) => (a.executionOrder ?? 99) - (b.executionOrder ?? 99))
        .map((row) => VisibleAssistants.find((assistant) => assistant.id === row.agentType))
        .filter((assistant): assistant is (typeof VisibleAssistants)[number] => Boolean(assistant))
    : VisibleAssistants;

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
            <h1 className="mt-4 text-3xl font-semibold text-slate-950">
              {isPreparingStrategy ? "AMI is preparing strategy workspace" : "AMI is coordinating assistants"}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              {isPreparingStrategy
                ? "AMI has completed assistant coordination and is preparing the prioritized recommendation."
                : "AMI is reviewing the market context, resolving assistant signals, and preparing the recommendation layer."}
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

        {latestResult?.preliminaryMetrics && (
          <div className="mt-5 rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">Preliminary metrics ready</p>
                <p className="mt-1 text-sm text-slate-600">Graph data is available while AMI finishes synthesis.</p>
              </div>
              {latestResult.sourceCollectionStatus.usedFallback && (
                <span className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900">
                  Fallback data
                </span>
              )}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricPreview label="Opportunity" value={`${latestResult.preliminaryMetrics.opportunityScoreBase}/100`} />
              <MetricPreview label="Margin" value={`${latestResult.preliminaryMetrics.estimatedMargin.toFixed(1)}%`} />
              <MetricPreview label="Demand" value={`${latestResult.preliminaryMetrics.demandSignal}/100`} />
              <MetricPreview label="Products" value={String(latestResult.preliminaryMetrics.productCount)} />
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-col gap-3">
          {displayAssistants.map((assistant) => {
            const state = assistantStates[assistant.id];
            const statusRow = latestResult?.agentStatus?.find((row) => row.agentType === assistant.id);

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
                    {statusRow?.goalIntent && <p className="mt-2 text-sm leading-6 text-slate-700">{statusRow.goalIntent}</p>}
                    <p className="mt-2 text-sm leading-6 text-slate-700">{activity[assistant.id]}</p>
                    {(statusRow?.fallbackSignals?.length || statusRow?.missingSignals?.length) ? (
                      <p className="mt-2 text-xs font-semibold uppercase text-amber-700">
                        {[...(statusRow.fallbackSignals ?? []), ...(statusRow.missingSignals ?? [])].join(", ")}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex min-w-48 flex-wrap items-center gap-3 sm:justify-end">
                  <span className="inline-flex items-center gap-2 text-sm font-semibold capitalize text-slate-700">
                    <StatusDot tone={dotTone(state)} />
                    {state}
                  </span>
                  <span className="text-xs font-semibold uppercase text-slate-500">{assistantSourceType(assistant.id)}</span>
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

function MetricPreview({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}
