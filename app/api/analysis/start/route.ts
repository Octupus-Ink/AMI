import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import { completeAnalysisRun, createAnalysisRunToMetrics, INVENTORY_CONTEXT_UNAVAILABLE_WARNING } from "@/lib/ami/analysis";
import { amiDiagLog, briefingDiagFields, createDiagRequestId } from "@/lib/diagnostics/ami-diag";
import { MarketContextPayloadSchema, type AnalysisResult } from "@/lib/schemas/ami";
import { findRecentAnalysisByBriefingFingerprint, getInventorySourceState, isUsableInventorySource, saveAnalysisResult } from "@/lib/services/ami-store";
import { jsonError, requireSession } from "@/lib/services/http";

const inventoryRequiredGoals = ["stock_optimization", "revenue_stock_opportunities"];
const inventoryOptionalGoals = ["discover_new_products"];
const inFlightAnalysisStarts = new Map<string, Promise<AnalysisResult>>();

function analysisJson(result: AnalysisResult, requestId: string, reused = false) {
  amiDiagLog(reused ? "api_analysis_start_existing_run_reused" : "api_analysis_start_response_returned", {
    requestId,
    analysisRunId: result.analysisRunId,
    route: "/api/analysis/start",
    responseStatus: 200,
    ok: true,
    sourceMode: result.sourceMode,
    usedFallback: result.fallbackUsed,
    dataQualityStatus: result.dataQualitySummary?.status,
    runStatus: result.status,
    existingRunFound: reused
  });
  if (reused) {
    amiDiagLog("analysis_run_reused", {
      requestId,
      analysisRunId: result.analysisRunId,
      route: "/api/analysis/start",
      responseStatus: 200,
      sourceMode: result.sourceMode,
      usedFallback: result.fallbackUsed,
      dataQualityStatus: result.dataQualitySummary?.status,
      runStatus: result.status,
      existingRunFound: true
    });
  }
  amiDiagLog("analysis_start_response_returned", {
    requestId,
    analysisRunId: result.analysisRunId,
    route: "/api/analysis/start",
    responseStatus: 200,
    ok: true,
    sourceMode: result.sourceMode,
    usedFallback: result.fallbackUsed,
    dataQualityStatus: result.dataQualitySummary?.status,
    runStatus: result.status,
    existingRunFound: reused
  });

  const json = NextResponse.json(result);
  json.headers.set("x-ami-request-id", requestId);
  return json;
}

function continueAgentCompletion(metricsReady: AnalysisResult) {
  if (metricsReady.status === "failed") {
    return;
  }

  // `after` keeps the Vercel serverless function alive until this callback
  // resolves, even after the HTTP response has been sent. Without it, Vercel
  // terminates the execution context at response time, leaving the run stuck
  // at "metrics_ready" and causing infinite frontend polling.
  after(async () => {
    try {
      await saveAnalysisResult({
        ...metricsReady,
        status: "agents_running",
        agentStatus: metricsReady.agentStatus.map((entry) => ({
          ...entry,
          status:
            entry.status === "skipped"
              ? "skipped"
              : entry.agentType === "trend" ||
                  entry.agentType === "competitor" ||
                  entry.agentType === "supplier" ||
                  entry.agentType === "inventory"
                ? "running"
                : "pending",
          latestActivity:
            entry.status === "skipped"
              ? entry.latestActivity
              : entry.agentType === "trend" ||
                    entry.agentType === "competitor" ||
                    entry.agentType === "supplier" ||
                    entry.agentType === "inventory"
                ? "Running deterministic specialist analysis on compact KPIs."
                : entry.latestActivity
        }))
      });
      const completed = await completeAnalysisRun(metricsReady);
      await saveAnalysisResult(completed);
    } catch (error) {
      const message = error instanceof Error ? error.message : "AMI analysis failed during AI synthesis.";
      await saveAnalysisResult({
        ...metricsReady,
        status: "failed",
        completedAt: new Date().toISOString(),
        warnings: [...metricsReady.warnings, message]
      });
    }
  });
}

export async function POST(request: NextRequest) {
  const requestStartedAt = Date.now();
  const requestId = request.headers.get("x-ami-request-id") ?? createDiagRequestId("api_start");

  amiDiagLog("api_analysis_start_received", {
    requestId,
    route: "/api/analysis/start",
    startedAt: new Date(requestStartedAt).toISOString()
  });
  request.signal.addEventListener("abort", () => {
    amiDiagLog("api_analysis_start_request_aborted", {
      requestId,
      route: "/api/analysis/start",
      abortReason: "client_request_signal"
    });
  });

  const { bundle, response } = await requireSession(request);

  if (!bundle) {
    amiDiagLog("api_analysis_start_auth_failed", {
      requestId,
      route: "/api/analysis/start",
      responseStatus: 401,
      ok: false
    });
    return response;
  }

  const parsed = MarketContextPayloadSchema.safeParse(await request.json());

  if (!parsed.success) {
    amiDiagLog("api_analysis_start_invalid_context", {
      requestId,
      route: "/api/analysis/start",
      responseStatus: 422,
      ok: false
    });
    return jsonError("Analysis request is invalid", 422);
  }

  const diagContext = briefingDiagFields(parsed.data, bundle.workspaceId);
  amiDiagLog("analysis_start_request_received", {
    requestId,
    route: "/api/analysis/start",
    startedAt: new Date(requestStartedAt).toISOString(),
    ...diagContext
  });
  const existingRun = await findRecentAnalysisByBriefingFingerprint(bundle.workspaceId, diagContext.briefingFingerprint);

  amiDiagLog("api_analysis_start_existing_run_lookup", {
    requestId,
    route: "/api/analysis/start",
    ...diagContext,
    existingRunFound: Boolean(existingRun),
    analysisRunId: existingRun?.analysisRunId,
    runStatus: existingRun?.status
  });

  if (existingRun) {
    return analysisJson(existingRun, requestId, true);
  }

  const idempotencyKey = `${bundle.workspaceId}:${diagContext.briefingFingerprint}`;
  const inFlightStart = inFlightAnalysisStarts.get(idempotencyKey);

  if (inFlightStart) {
    amiDiagLog("api_analysis_start_inflight_reused", {
      requestId,
      route: "/api/analysis/start",
      ...diagContext,
      existingRunFound: true
    });
    const reused = await inFlightStart;
    return analysisJson(reused, requestId, true);
  }

  const startPromise = (async () => {
    const inventoryStatus = await getInventorySourceState(bundle.workspaceId);
    const inventoryAvailable = isUsableInventorySource(inventoryStatus);
    const inventoryRequired = inventoryRequiredGoals.includes(parsed.data.businessGoal);
    const inventoryOptional = inventoryOptionalGoals.includes(parsed.data.businessGoal);

    if (inventoryRequired && !inventoryAvailable) {
      throw new Error("INVENTORY_CONTEXT_REQUIRED");
    }

    const inventoryRequested = parsed.data.useInventoryContext || inventoryRequired;
    const inventoryWarning =
      inventoryOptional && inventoryRequested && !inventoryAvailable ? INVENTORY_CONTEXT_UNAVAILABLE_WARNING : undefined;
    const metricsReady = await createAnalysisRunToMetrics(bundle.workspaceId, { ...parsed.data, useInventoryContext: inventoryRequested }, {
      requested: inventoryRequested,
      available: inventoryRequested && inventoryAvailable,
      warningMessage: inventoryWarning,
      sourceLabel: inventoryStatus.latestConnectionLabel
    }, {
      requestId,
      briefingFingerprint: diagContext.briefingFingerprint
    });

    amiDiagLog("api_analysis_start_new_run_created", {
      requestId,
      analysisRunId: metricsReady.analysisRunId,
      route: "/api/analysis/start",
      ...diagContext,
      sourceMode: metricsReady.sourceMode,
      usedFallback: metricsReady.fallbackUsed,
      dataQualityStatus: metricsReady.dataQualitySummary?.status
    });
    amiDiagLog("analysis_run_created", {
      requestId,
      analysisRunId: metricsReady.analysisRunId,
      route: "/api/analysis/start",
      ...diagContext,
      existingRunFound: false,
      runStatus: metricsReady.status,
      sourceMode: metricsReady.sourceMode,
      usedFallback: metricsReady.fallbackUsed,
      dataQualityStatus: metricsReady.dataQualitySummary?.status,
      startedAt: metricsReady.startedAt,
      createdAt: metricsReady.startedAt
    });
    await saveAnalysisResult(metricsReady);
    continueAgentCompletion(metricsReady);
    return metricsReady;
  })();

  inFlightAnalysisStarts.set(idempotencyKey, startPromise);

  try {
    const metricsReady = await startPromise;
    amiDiagLog("api_analysis_start_duration", {
      requestId,
      analysisRunId: metricsReady.analysisRunId,
      route: "/api/analysis/start",
      durationMs: Date.now() - requestStartedAt
    });
    return analysisJson(metricsReady, requestId);
  } catch (error) {
    if (error instanceof Error && error.message === "INVENTORY_CONTEXT_REQUIRED") {
      amiDiagLog("api_analysis_start_inventory_required_failed", {
        requestId,
        route: "/api/analysis/start",
        ...diagContext,
        responseStatus: 422,
        ok: false
      });
      return jsonError("Inventory context is required for this business goal. Connect an inventory source before starting analysis.", 422);
    }

    throw error;
  } finally {
    if (inFlightAnalysisStarts.get(idempotencyKey) === startPromise) {
      inFlightAnalysisStarts.delete(idempotencyKey);
    }
  }
}
