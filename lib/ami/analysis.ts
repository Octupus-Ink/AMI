import { randomUUID } from "node:crypto";
import type { AgentOutput, RiskLevel, VerdictAgentOutput } from "@/lib/schemas/agents";
import type {
  AnalysisResult,
  AssistantContribution,
  AssistantFinding,
  EvidencePackage,
  MarketContextPayload,
  NormalizedProduct,
  Recommendation,
  SourceMode,
  SupplierOption
} from "@/lib/schemas/ami";
import {
  AnalysisResultSchema,
  AssistantFindingSchema,
  RecommendationSchema
} from "@/lib/schemas/ami";
import { buildGraphData } from "@/lib/analysis/graph-data";
import { extractPreliminaryMetrics } from "@/lib/analysis/kpi-extraction";
import { buildEvidencePackages } from "@/lib/analysis/evidence";
import { collectBrightDataEvidence } from "@/lib/data-providers/brightdata/client";
import { buildAgentStatus, buildPendingAgentStatus, runAmiAgents } from "@/lib/agents/orchestrator";
import type { AgentContext } from "@/lib/agents/types";

export const INVENTORY_CONTEXT_UNAVAILABLE_WARNING =
  "Inventory context was requested, but no usable inventory source is connected. AMI continued using trend, competitor, and supplier signals.";

export type InventoryRunContext = {
  requested: boolean;
  available: boolean;
  warningMessage?: string;
  sourceLabel?: string;
};

function signalLevel(value: number): "weak" | "moderate" | "strong" {
  if (value >= 70) {
    return "strong";
  }

  if (value >= 45) {
    return "moderate";
  }

  return "weak";
}

function confidenceLevel(value: number): "low" | "medium" | "high" {
  if (value >= 0.78) {
    return "high";
  }

  if (value >= 0.55) {
    return "medium";
  }

  return "low";
}

function riskForLegacy(risk: RiskLevel): "low" | "medium" | "high" {
  if (risk === "critical") {
    return "high";
  }

  if (risk === "unknown") {
    return "medium";
  }

  return risk;
}

function modeFromCollection(status: string, usedFallback: boolean): SourceMode {
  if (usedFallback) {
    return "demo_fallback";
  }

  if (status === "live") {
    return "live";
  }

  if (status === "not_configured") {
    return "not_configured";
  }

  if (status === "error") {
    return "error";
  }

  return "demo_fallback";
}

function fallbackVerdict(analysisRunId: string, context: MarketContextPayload, products: NormalizedProduct[]): VerdictAgentOutput {
  return {
    agentType: "strategy",
    status: "fallback",
    finalVerdict: "AMI preliminary metrics are ready; final AI verdict is still pending.",
    recommendedAction: `Continue monitoring ${context.productName} until the strategy agent completes.`,
    reasoning: "The API has completed Bright Data collection, normalization, KPI extraction, and graph preparation.",
    confidence: 0.55,
    riskLevel: "medium",
    nextStep: "Poll this analysis run for the final AMI verdict.",
    agentAgreement: [],
    agentConflicts: [],
    evidenceSummary: [],
    externalActionPayload: {
      actionType: "analysis_pending",
      priority: "medium",
      requiresHumanApproval: true,
      targetProducts: products.slice(0, 5).map((product) => product.externalId ?? product.title),
      sourceAnalysisRunId: analysisRunId
    }
  };
}

function buildSupplierOptions(context: MarketContextPayload, products: NormalizedProduct[]): SupplierOption[] {
  const seen = new Set<string>();

  return products
    .filter((product) => product.supplierName || product.supplierPrice)
    .map((product, index) => ({
      supplierName: product.supplierName ?? `${context.supplierSource} option ${index + 1}`,
      source: product.source,
      estimatedUnitCost: product.supplierPrice ?? 0,
      estimatedDeliveryTime: product.estimatedDeliveryTime ?? "Validation required",
      availability: product.availability ?? "Unknown",
      ratingQualityProxy: product.rating ? `${product.rating.toFixed(1)} / 5 rating proxy` : "Quality proxy pending",
      matchConfidence: confidenceLevel(product.matchConfidence ?? 0.6),
      risk: riskForLegacy((product.riskScore ?? 50) >= 75 ? "high" : (product.riskScore ?? 50) >= 45 ? "medium" : "low")
    }))
    .filter((supplier) => {
      const key = `${supplier.supplierName}-${supplier.estimatedUnitCost}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .slice(0, 5);
}

function contributionFromOutput(output: AgentOutput, sourceMode: SourceMode): AssistantContribution {
  const usageCost: Record<string, number> = {
    trend: 0.4,
    competitor: 0.5,
    supplier: 0.5,
    inventory: 0.3,
    coordinator: 0.9,
    strategy: 1
  };
  const finding = "finding" in output ? output.finding : "summary" in output ? output.summary : output.finalVerdict;
  const reason = "summary" in output ? output.summary : output.reasoning;

  return {
    assistantId: output.agentType,
    summary: reason,
    latestContribution: finding,
    signalStrength: output.confidence >= 0.75 ? "strong" : output.confidence >= 0.55 ? "moderate" : "weak",
    confidence: confidenceLevel(output.confidence),
    risk: riskForLegacy(output.riskLevel),
    dataSourcesUsed: [
      sourceMode === "live" ? "Bright Data live normalized evidence" : "Bright Data-shaped fallback evidence",
      output.status === "fallback" ? "Deterministic agent fallback" : "Compact KPI evidence"
    ],
    usageCost: usageCost[output.agentType] ?? 0.2
  };
}

function findingFromOutput(output: AgentOutput, sourceMode: SourceMode): AssistantFinding {
  const finding = "finding" in output ? output.finding : "summary" in output ? output.summary : output.finalVerdict;
  const reason = "summary" in output ? output.summary : output.reasoning;

  return AssistantFindingSchema.parse({
    assistantId: output.agentType,
    finding,
    reason,
    signal: output.confidence >= 0.75 ? "strong" : output.confidence >= 0.55 ? "moderate" : "weak",
    confidence: confidenceLevel(output.confidence),
    risk: riskForLegacy(output.riskLevel),
    sourceType: sourceMode === "live" ? "Bright Data live data" : "Bright Data fallback data",
    sourceLabel: output.status === "fallback" ? "Fallback agent output" : "Normalized KPI evidence",
    dataFreshness: sourceMode === "live" ? "Collected during this analysis run" : "Deterministic fallback generated during this run"
  });
}

function buildRecommendation(
  workspaceId: string,
  analysisRunId: string,
  context: MarketContextPayload,
  verdict: VerdictAgentOutput,
  products: NormalizedProduct[],
  evidencePackage: EvidencePackage,
  sourceMode: SourceMode,
  outputs: AgentOutput[]
): Recommendation {
  const primary = products[0];

  return RecommendationSchema.parse({
    recommendationId: randomUUID(),
    analysisRunId,
    workspaceId,
    recommendedAction: verdict.recommendedAction,
    opportunityScore: Math.round(Math.min(100, Math.max(0, (primary?.demandSignal ?? 60) * 0.35 + (primary?.estimatedMargin ?? 35) * 0.9))),
    estimatedMargin: primary?.estimatedMargin ?? evidencePackage.estimatedMargin,
    demandSignal: signalLevel(primary?.demandSignal ?? 55),
    riskLevel: riskForLegacy(verdict.riskLevel),
    confidenceLevel: confidenceLevel(verdict.confidence),
    signalStrength: signalLevel(primary?.trendMomentum ?? 55),
    dataFreshness:
      sourceMode === "live"
        ? "Live Bright Data collection completed during this run"
        : "Fallback uses deterministic Bright Data-shaped source snapshots",
    matchQuality: confidenceLevel(primary?.matchConfidence ?? 0.6),
    primaryReason: verdict.reasoning,
    suggestedNextStep: verdict.nextStep,
    assistantContributions: outputs.map((output) => contributionFromOutput(output, sourceMode)),
    evidencePackageId: evidencePackage.evidencePackageId,
    status: "new",
    createdAt: new Date().toISOString()
  });
}

function secondaryRecommendation(primary: Recommendation, context: MarketContextPayload): Recommendation {
  return RecommendationSchema.parse({
    ...primary,
    recommendationId: randomUUID(),
    recommendedAction: `Monitor ${context.productName} competitor movement before broad rollout`,
    opportunityScore: Math.max(0, primary.opportunityScore - 8),
    confidenceLevel: "medium",
    primaryReason: "A monitor-and-adjust path remains useful if competitor pressure or trend momentum changes after the first action.",
    suggestedNextStep: "Review graph metrics and supplier terms after the first validation window."
  });
}

function assistantStatusRecord(agentStatus: AnalysisResult["agentStatus"]): AnalysisResult["assistantStatus"] {
  return Object.fromEntries(agentStatus.map((entry) => [entry.agentType, entry.status])) as AnalysisResult["assistantStatus"];
}

export async function createAnalysisRunToMetrics(
  workspaceId: string,
  context: MarketContextPayload,
  inventoryContext: InventoryRunContext = { requested: context.useInventoryContext, available: context.useInventoryContext }
): Promise<AnalysisResult> {
  const analysisRunId = randomUUID();
  const startedAt = new Date().toISOString();
  const collection = await collectBrightDataEvidence(context);
  const sourceMode = modeFromCollection(collection.status, collection.usedFallback);
  const metrics = extractPreliminaryMetrics(collection.products, collection.evidenceRefs.length);
  const graphData = buildGraphData(collection.products, metrics);
  const evidencePackages = buildEvidencePackages(
    context,
    collection.products,
    collection.evidenceRefs,
    sourceMode,
    collection.brightDataProduct,
    collection.collectedAt
  );
  const pendingVerdict = fallbackVerdict(analysisRunId, context, collection.products);
  const pendingOutputs: AgentOutput[] = [pendingVerdict];
  const executiveRecommendation = buildRecommendation(
    workspaceId,
    analysisRunId,
    context,
    pendingVerdict,
    collection.products,
    evidencePackages[0],
    sourceMode,
    pendingOutputs
  );
  const agentStatus = buildPendingAgentStatus();
  const warnings = [
    ...collection.warnings,
    inventoryContext.warningMessage
  ].filter((warning): warning is string => Boolean(warning));

  return AnalysisResultSchema.parse({
    analysisRunId,
    workspaceId,
    marketContext: context,
    status: collection.status === "error" && !collection.usedFallback ? "failed" : "metrics_ready",
    startedAt,
    assistantStatus: assistantStatusRecord(agentStatus),
    sourceCollectionStatus: {
      brightDataProduct: collection.brightDataProduct,
      mode: sourceMode,
      label: collection.label,
      collectedAt: collection.collectedAt,
      providerStatus: collection.status,
      usedFallback: collection.usedFallback,
      fallbackReason: collection.fallbackReason,
      maxResults: collection.maxResults
    },
    normalizedProducts: collection.products,
    evidenceRefs: collection.evidenceRefs,
    preliminaryMetrics: metrics,
    graphData,
    agentStatus,
    agentRuns: [],
    synthesis: undefined,
    finalVerdict: undefined,
    externalActionPayload: pendingVerdict.externalActionPayload,
    usedFallback: collection.usedFallback,
    fallbackReason: collection.fallbackReason,
    executiveRecommendation,
    opportunities: [executiveRecommendation, secondaryRecommendation(executiveRecommendation, context)],
    assistantFindings: [],
    evidencePackages,
    supplierOptions: buildSupplierOptions(context, collection.products),
    warnings,
    demoMode: collection.usedFallback
  });
}

export async function completeAnalysisRun(metricsRun: AnalysisResult): Promise<AnalysisResult> {
  if (metricsRun.status === "failed") {
    return metricsRun;
  }

  const metrics = metricsRun.preliminaryMetrics;

  if (!metrics) {
    throw new Error("Analysis run cannot continue without preliminary metrics.");
  }

  const agentContext: AgentContext = {
    analysisRunId: metricsRun.analysisRunId,
    briefing: metricsRun.marketContext,
    products: metricsRun.normalizedProducts.slice(0, 5),
    metrics,
    evidenceRefs: metricsRun.evidenceRefs.slice(0, 10),
    inventoryContext: {
      requested: metricsRun.marketContext.useInventoryContext,
      available: !metricsRun.warnings.includes(INVENTORY_CONTEXT_UNAVAILABLE_WARNING),
      warningMessage: metricsRun.warnings.find((warning) => warning === INVENTORY_CONTEXT_UNAVAILABLE_WARNING),
      sourceLabel: undefined
    }
  };
  const agentResult = await runAmiAgents(agentContext);
  const sourceMode = metricsRun.sourceCollectionStatus.mode;
  const outputs = agentResult.outputs;
  const finalVerdict = agentResult.finalVerdict;
  const primaryEvidence = metricsRun.evidencePackages[0];
  const executiveRecommendation = buildRecommendation(
    metricsRun.workspaceId,
    metricsRun.analysisRunId,
    metricsRun.marketContext,
    finalVerdict,
    metricsRun.normalizedProducts,
    primaryEvidence,
    sourceMode,
    outputs
  );
  const agentStatus = buildAgentStatus(outputs);
  const usedFallback = metricsRun.usedFallback || agentResult.usedFallback;
  const warnings = [...metricsRun.warnings, ...agentResult.warnings].filter(Boolean);

  return AnalysisResultSchema.parse({
    ...metricsRun,
    status: usedFallback ? "completed_with_fallback" : "completed",
    completedAt: new Date().toISOString(),
    assistantStatus: assistantStatusRecord(agentStatus),
    agentStatus,
    agentRuns: outputs,
    synthesis: agentResult.synthesis,
    finalVerdict,
    externalActionPayload: finalVerdict.externalActionPayload,
    executiveRecommendation,
    opportunities: [executiveRecommendation, secondaryRecommendation(executiveRecommendation, metricsRun.marketContext)],
    assistantFindings: outputs.map((output) => findingFromOutput(output, sourceMode)),
    warnings,
    usedFallback,
    fallbackReason: usedFallback ? warnings[0] ?? metricsRun.fallbackReason : undefined,
    demoMode: usedFallback
  });
}

export async function runAmiAnalysis(
  workspaceId: string,
  context: MarketContextPayload,
  inventoryContext: InventoryRunContext = { requested: context.useInventoryContext, available: context.useInventoryContext }
): Promise<AnalysisResult> {
  const metricsRun = await createAnalysisRunToMetrics(workspaceId, context, inventoryContext);
  return completeAnalysisRun(metricsRun);
}
