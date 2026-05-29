import { randomUUID } from "node:crypto";
import type { AgentOutput, RiskLevel, VerdictAgentOutput } from "@/lib/schemas/agents";
import type {
  AnalysisResult,
  AssistantRunTrace,
  AssistantContribution,
  AssistantFinding,
  CoordinatorRunTrace,
  EvidencePackage,
  EvidenceTraceMetadata,
  MarketContextPayload,
  NormalizedProduct,
  NormalizedSourceMode,
  RawSnapshotMetadata,
  Recommendation,
  SourceMode,
  SourceProvider,
  SourceSummary,
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
import { normalizeVisibleEvidenceItems, resolveSourceState } from "@/lib/analysis/source-state";
import {
  amiLog,
  extractedProductFields,
  isSourceFallbackMode,
  normalizeSourceTrace,
  sourceModeLabel
} from "@/lib/analysis/source-trace";
import { writeRunArtifacts } from "@/lib/analysis/run-artifacts";
import { collectBrightDataEvidence } from "@/lib/data-providers/brightdata/client";
import type { BrightDataCollectionResult } from "@/lib/data-providers/brightdata/types";
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

const SPECIALIST_ASSISTANTS = ["trend", "competitor", "supplier", "inventory"] as const;

function sourceFallbackUsed(mode: SourceMode | NormalizedSourceMode) {
  return isSourceFallbackMode(mode);
}

function sourceDescriptionForMode(sourceMode: SourceMode | NormalizedSourceMode) {
  if (sourceMode === "live") {
    return "Bright Data live normalized evidence";
  }

  if (sourceMode === "fallback_snapshot") {
    return "Bright Data preserved raw snapshot evidence";
  }

  if (sourceMode === "demo_seed") {
    return "Demo seed evidence";
  }

  if (sourceMode === "mixed") {
    return "Bright Data evidence with fallback records";
  }

  if (sourceMode === "demo_fallback" || sourceMode === "demo_snapshot") {
    return "Demo seed evidence";
  }

  return "Provider status evidence";
}

function sourceTypeForMode(sourceMode: SourceMode | NormalizedSourceMode) {
  if (sourceMode === "live") {
    return "Bright Data live data";
  }

  if (sourceMode === "fallback_snapshot") {
    return "Bright Data fallback snapshot";
  }

  if (sourceMode === "demo_seed" || sourceMode === "demo_fallback" || sourceMode === "demo_snapshot") {
    return "Demo seed data";
  }

  return "Provider status data";
}

function dataFreshnessForMode(sourceMode: SourceMode | NormalizedSourceMode) {
  if (sourceMode === "live") {
    return "Live Bright Data collection completed during this run";
  }

  if (sourceMode === "fallback_snapshot") {
    return "Preserved Bright Data raw snapshot loaded during this run";
  }

  if (sourceMode === "demo_seed" || sourceMode === "demo_fallback" || sourceMode === "demo_snapshot") {
    return "Deterministic demo seed generated during this run";
  }

  return "Provider did not return live evidence";
}

function rawRefForCollection(collection: BrightDataCollectionResult) {
  return collection.rawSnapshotRefs[0] ?? (collection.rawSnapshotsSaved > 0 ? "mongo:rawSourceSnapshots" : undefined);
}

function sourceNameForCollection(collection: BrightDataCollectionResult) {
  return collection.sourceProducts[0] ?? collection.brightDataProduct;
}

function buildRawSnapshotMetadata(
  runId: string,
  collection: BrightDataCollectionResult,
  sourceMode: NormalizedSourceMode,
  sourceProvider: SourceProvider
): RawSnapshotMetadata[] {
  const rawRef = rawRefForCollection(collection);

  if (!rawRef && collection.rawSnapshotsLoaded === 0 && collection.rawSnapshotsSaved === 0) {
    return [];
  }

  return [
    {
      runId,
      sourceProvider,
      sourceProduct: collection.sourceProduct,
      sourceType: sourceMode === "fallback_snapshot" ? "bright_data_preserved_raw_snapshot" : "bright_data_live_web_data",
      sourceName: sourceNameForCollection(collection),
      rawRef: rawRef ?? "not_saved",
      capturedAt: collection.collectedAt,
      mode: sourceMode,
      recordCount: collection.products.length,
      status: collection.rawSnapshotsLoaded > 0 ? "loaded_from_snapshot" : collection.rawSnapshotsSaved > 0 ? "success" : "not_saved",
      safeError: collection.fallbackReason
    }
  ];
}

function buildEvidenceMetadata(
  runId: string,
  collection: BrightDataCollectionResult,
  sourceMode: NormalizedSourceMode,
  sourceProvider: SourceProvider
): EvidenceTraceMetadata[] {
  const rawRef = rawRefForCollection(collection);

  return collection.evidenceRefs.map((ref) => {
    const product = collection.products.find((candidate) => candidate.evidenceRefs.includes(ref.id));
    const matchScore = Math.round((product?.matchConfidence ?? product?.confidence ?? 0.65) * 100);

    return {
      runId,
      sourceProvider,
      sourceProduct: collection.sourceProduct,
      sourceType:
        sourceMode === "live"
          ? "bright_data_live_web_data"
          : sourceMode === "fallback_snapshot"
            ? "bright_data_preserved_raw_snapshot"
            : "demo_seed",
      sourceName: sourceNameForCollection(collection),
      targetMarketplace: collection.targetMarketplace,
      scraperName: collection.scraperName,
      datasetId: collection.datasetId,
      operation: collection.operation,
      snapshotId: collection.snapshotId,
      ...(ref.url ? { sourceUrl: ref.url } : {}),
      ...(ref.url ? { productUrl: ref.url } : {}),
      ...(product?.imageUrl ? { imageUrl: product.imageUrl } : {}),
      title: product?.title ?? ref.label,
      price: product?.priceUsd ?? product?.price,
      currency: product?.currency,
      rating: product?.rating,
      reviewsCount: product?.reviewsCount,
      availability: product?.availability,
      sellerName: product?.supplierName,
      category: product?.category,
      ...(rawRef ? { rawRef } : {}),
      capturedAt: ref.collectedAt ?? collection.collectedAt,
      mode: sourceMode,
      sourceMode,
      extractedFields: extractedProductFields(product as Record<string, unknown> | undefined),
      assistantTypesUsedBy: [...SPECIALIST_ASSISTANTS],
      confidence: product?.confidence,
      matchScore
    };
  });
}

function buildAssistantRunTrace(
  runId: string,
  outputs: AgentOutput[],
  sourceSummary: SourceSummary | undefined,
  startedAt: string,
  completedAt: string
): AssistantRunTrace[] {
  const sourceDescriptions = sourceSummary?.productsUsed.length
    ? sourceSummary.productsUsed
    : [sourceDescriptionForMode(sourceSummary?.fallbackUsed ? "demo_seed" : "live")];

  return SPECIALIST_ASSISTANTS.map((assistantType) => {
    const output = outputs.find((candidate) => candidate.agentType === assistantType);

    return {
      runId,
      assistantRunId: `${runId}:${assistantType}`,
      assistantType,
      status: output?.status ?? "skipped",
      startedAt,
      completedAt,
      dataSourcesUsed: sourceDescriptions,
      evidenceIds: evidenceIdsFromOutput(output),
      latestContribution: output && "finding" in output ? output.finding : undefined,
      usageEstimate: assistantType === "trend" ? 0.4 : assistantType === "inventory" ? 0.3 : 0.5,
      warning: output?.status === "fallback" ? "Assistant used deterministic fallback output." : undefined
    };
  });
}

function evidenceIdsFromOutput(output: AgentOutput | undefined) {
  return output && "evidenceUsed" in output ? output.evidenceUsed : [];
}

function buildCoordinatorTrace(
  runId: string,
  outputs: AgentOutput[],
  recommendationId: string,
  sourceMode: NormalizedSourceMode,
  fallbackUsed: boolean,
  startedAt: string,
  completedAt: string
): CoordinatorRunTrace {
  const synthesis = outputs.find((output) => output.agentType === "coordinator");
  const verdict = outputs.find((output) => output.agentType === "strategy");

  return {
    runId,
    coordinatorRunId: `${runId}:ami_orchestrator`,
    coordinatorType: "ami_orchestrator",
    status: synthesis?.status ?? verdict?.status ?? "completed",
    startedAt,
    completedAt,
    assistantRunIds: SPECIALIST_ASSISTANTS.map((assistantType) => `${runId}:${assistantType}`),
    evidenceIds: outputs.flatMap((output) => evidenceIdsFromOutput(output)),
    finalRecommendationId: recommendationId,
    reasoningSummary:
      synthesis && "summary" in synthesis
        ? synthesis.summary
        : verdict && "reasoning" in verdict
          ? verdict.reasoning
          : "AMI orchestrator synthesized specialist outputs into the final recommendation.",
    assistantContributionSummary: Object.fromEntries(
      SPECIALIST_ASSISTANTS.map((assistantType) => {
        const output = outputs.find((candidate) => candidate.agentType === assistantType);
        return [assistantType, output && "finding" in output ? output.finding : "No specialist output recorded."];
      })
    ),
    confidence: synthesis && "confidence" in synthesis ? synthesis.confidence : verdict && "confidence" in verdict ? verdict.confidence : undefined,
    riskScore: verdict?.riskLevel === "high" || verdict?.riskLevel === "critical" ? 75 : verdict?.riskLevel === "medium" ? 50 : 25,
    sourceMode,
    fallbackUsed
  };
}

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

  const sourceDescription = sourceDescriptionForMode(sourceMode);

  return {
    assistantId: output.agentType,
    summary: reason,
    latestContribution: finding,
    signalStrength: output.confidence >= 0.75 ? "strong" : output.confidence >= 0.55 ? "moderate" : "weak",
    confidence: confidenceLevel(output.confidence),
    risk: riskForLegacy(output.riskLevel),
    dataSourcesUsed: [sourceDescription, output.status === "fallback" ? "Deterministic assistant output" : "Compact KPI evidence"],
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
    sourceType: sourceTypeForMode(sourceMode),
    sourceLabel: output.status === "fallback" ? "Deterministic assistant output" : "Normalized KPI evidence",
    dataFreshness: dataFreshnessForMode(sourceMode)
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
    dataFreshness: dataFreshnessForMode(sourceMode),
    matchQuality: confidenceLevel(primary?.matchConfidence ?? 0.6),
    primaryReason: verdict.reasoning,
    suggestedNextStep: verdict.nextStep,
    assistantContributions: outputs.map((output) => contributionFromOutput(output, sourceMode)),
    evidencePackageId: evidencePackage.evidencePackageId,
    sourceMode,
    fallbackUsed: sourceFallbackUsed(sourceMode),
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
  amiLog("RUN", "RUN_CREATED", {
    runId: analysisRunId,
    workspaceId,
    marketplace: context.targetMarketplace,
    product: context.productName
  });
  const collection = await collectBrightDataEvidence(context);

  if (collection.liveAttempted) {
    amiLog("BRIGHTDATA", "SOURCE_COLLECTION_START", {
      runId: analysisRunId,
      source: context.targetMarketplace,
      product: context.productName,
      attempts: collection.attempts.length
    });
  } else {
    amiLog("BRIGHTDATA", "SOURCE_COLLECTION_SKIPPED", {
      runId: analysisRunId,
      reason: collection.fallbackReason ?? "Live Bright Data was not attempted."
    });
  }

  for (const attempt of collection.attempts) {
    if (attempt.product === "Web Scraper API" && attempt.status !== "skipped") {
      amiLog("BRIGHTDATA", "SCRAPER_START", {
        runId: analysisRunId,
        marketplace: attempt.marketplace,
        operation: attempt.operation,
        datasetId: attempt.datasetId,
        inputType: attempt.inputType
      });
    }

    if (attempt.product === "Web Unlocker" && attempt.status !== "skipped") {
      amiLog("BRIGHTDATA", "WEB_UNLOCKER_START", {
        runId: analysisRunId,
        marketplace: attempt.marketplace,
        operation: attempt.operation,
        inputType: attempt.inputType
      });
    }

    if (attempt.status === "success" && attempt.product === "Web Scraper API") {
      amiLog("BRIGHTDATA", "SCRAPER_SUCCESS", {
        runId: analysisRunId,
        source: attempt.sourceName ?? attempt.product,
        records: attempt.recordCount ?? collection.products.length,
        snapshotId: attempt.snapshotId
      });
    }

    if (attempt.status === "empty" && attempt.product === "Web Scraper API") {
      amiLog("BRIGHTDATA", "SCRAPER_EMPTY", {
        runId: analysisRunId,
        source: attempt.sourceName ?? attempt.product,
        records: 0,
        snapshotId: attempt.snapshotId
      });
    }

    if (attempt.status === "failed" && attempt.product === "Web Scraper API") {
      amiLog("BRIGHTDATA", "SCRAPER_FAILED", {
        runId: analysisRunId,
        source: attempt.sourceName ?? attempt.product,
        reason: attempt.safeError
      });
    }

    if (attempt.status === "success" && attempt.product === "Web Unlocker") {
      amiLog("BRIGHTDATA", "WEB_UNLOCKER_SUCCESS", {
        runId: analysisRunId,
        source: attempt.sourceName ?? attempt.product,
        records: attempt.recordCount ?? collection.products.length
      });
    }

    if (attempt.status === "failed" && attempt.product === "Web Unlocker") {
      amiLog("BRIGHTDATA", "WEB_UNLOCKER_FAILED", {
        runId: analysisRunId,
        source: attempt.sourceName ?? attempt.product,
        reason: attempt.safeError
      });
    }
  }

  if (collection.rawSnapshotsLoaded > 0) {
    amiLog("BRIGHTDATA", "FALLBACK_SNAPSHOT_LOAD", {
      runId: analysisRunId,
      source: sourceNameForCollection(collection),
      rawRef: rawRefForCollection(collection),
      records: collection.products.length
    });
  }

  const sourceTrace = normalizeSourceTrace({
    status: collection.status,
    usedFallback: collection.usedFallback,
    liveAttempted: collection.liveAttempted,
    liveSucceeded: collection.liveSucceeded,
    fallbackKind: collection.fallbackKind,
    sourceProvider: collection.sourceProvider,
    sourceProducts: collection.sourceProducts,
    rawSnapshotsSaved: collection.rawSnapshotsSaved,
    rawSnapshotsLoaded: collection.rawSnapshotsLoaded,
    evidenceItemsCreated: collection.evidenceRefs.length
  });
  const { sourceMode, fallbackUsed, sourceProvider, sourceProducts, sourceSummary } = sourceTrace;
  const rawSnapshotMetadata = buildRawSnapshotMetadata(analysisRunId, collection, sourceMode, sourceProvider);
  const evidenceMetadata = buildEvidenceMetadata(analysisRunId, collection, sourceMode, sourceProvider);
  const sourceState = resolveSourceState({
    mode: sourceMode,
    status: collection.status,
    usedFallback: fallbackUsed,
    fallbackUsed,
    demoSnapshotUsed: sourceMode === "demo_seed",
    liveProviderUsed: sourceMode === "live",
    products: collection.products,
    evidenceRefs: collection.evidenceRefs
  });

  if (collection.rawSnapshotsSaved > 0) {
    amiLog("BRIGHTDATA", "RAW_SNAPSHOT_SAVED", {
      runId: analysisRunId,
      target: "mongo:rawSourceSnapshots",
      records: collection.products.length
    });
  }

  amiLog("EVIDENCE", "NORMALIZATION_COMPLETE", {
    runId: analysisRunId,
    sourceMode,
    fallbackUsed,
    products: collection.products.length,
    evidenceItems: collection.evidenceRefs.length
  });

  const metrics = extractPreliminaryMetrics(collection.products, collection.evidenceRefs.length);
  const graphData = buildGraphData(collection.products, metrics);
  const evidencePackages = buildEvidencePackages(
    context,
    collection.products,
    collection.evidenceRefs,
    sourceMode,
    collection.brightDataProduct,
    collection.collectedAt,
    {
      runId: analysisRunId,
      sourceProvider,
      sourceProduct: collection.sourceProduct,
      sourceName: sourceNameForCollection(collection),
      targetMarketplace: collection.targetMarketplace,
      scraperName: collection.scraperName,
      datasetId: collection.datasetId,
      operation: collection.operation,
      snapshotId: collection.snapshotId,
      rawRef: rawRefForCollection(collection),
      mode: sourceMode,
      assistantTypesUsedBy: [...SPECIALIST_ASSISTANTS]
    }
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
  const sourceProof = normalizeVisibleEvidenceItems(collection.evidenceRefs, sourceState, collection.collectedAt);
  const warnings = [
    ...collection.warnings,
    inventoryContext.warningMessage
  ].filter((warning): warning is string => Boolean(warning));

  const result = AnalysisResultSchema.parse({
    analysisRunId,
    workspaceId,
    marketContext: context,
    status: collection.products.length ? "metrics_ready" : "failed",
    startedAt,
    sourceMode,
    fallbackUsed,
    sourceProvider,
    sourceProducts,
    sourceSummary,
    rawSnapshotMetadata,
    evidenceMetadata,
    assistantRunTrace: [],
    coordinatorTrace: undefined,
    assistantStatus: assistantStatusRecord(agentStatus),
    sourceCollectionStatus: {
      brightDataProduct: collection.brightDataProduct,
      mode: sourceMode,
      label: collection.label,
      collectedAt: collection.collectedAt,
      providerStatus: sourceState.providerStatus,
      usedFallback: fallbackUsed,
      fallbackUsed,
      demoSnapshotUsed: sourceMode === "demo_seed",
      liveProviderUsed: sourceMode === "live",
      sourceLabel: sourceModeLabel(sourceMode),
      sourceProof,
      liveRecordCount: sourceState.liveRecordCount,
      fallbackRecordCount: sourceState.fallbackRecordCount,
      fallbackReason: fallbackUsed || collection.status === "error" || collection.status === "not_configured" ? collection.fallbackReason : undefined,
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
    usedFallback: fallbackUsed,
    fallbackReason: fallbackUsed || collection.status === "error" || collection.status === "not_configured" ? collection.fallbackReason : undefined,
    executiveRecommendation,
    opportunities: [executiveRecommendation, secondaryRecommendation(executiveRecommendation, context)],
    assistantFindings: [],
    evidencePackages,
    supplierOptions: buildSupplierOptions(context, collection.products),
    warnings,
    demoMode: sourceMode === "demo_seed"
  });

  writeRunArtifacts(result);
  return result;
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
  const assistantStartedAt = new Date().toISOString();

  for (const assistantType of SPECIALIST_ASSISTANTS) {
    amiLog("ASSISTANT", "ASSISTANT_START", {
      runId: metricsRun.analysisRunId,
      assistantType,
      sourceMode: metricsRun.sourceMode
    });
  }

  amiLog("COORDINATOR", "COORDINATOR_START", {
    runId: metricsRun.analysisRunId,
    coordinatorType: "ami_orchestrator"
  });

  const agentResult = await runAmiAgents(agentContext);
  const completedAt = new Date().toISOString();
  const sourceMode = metricsRun.sourceMode;
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
  const sourceFallbackUsed = metricsRun.fallbackUsed;
  const usedFallback = sourceFallbackUsed || agentResult.usedFallback;
  const warnings = [...metricsRun.warnings, ...agentResult.warnings].filter(Boolean);
  const assistantRunTrace = buildAssistantRunTrace(
    metricsRun.analysisRunId,
    outputs,
    metricsRun.sourceSummary,
    assistantStartedAt,
    completedAt
  );
  const coordinatorTrace = buildCoordinatorTrace(
    metricsRun.analysisRunId,
    outputs,
    executiveRecommendation.recommendationId,
    sourceMode,
    sourceFallbackUsed,
    assistantStartedAt,
    completedAt
  );

  for (const trace of assistantRunTrace) {
    amiLog("ASSISTANT", "ASSISTANT_COMPLETE", {
      runId: metricsRun.analysisRunId,
      assistantType: trace.assistantType,
      status: trace.status,
      evidenceItems: trace.evidenceIds.length
    });
  }

  amiLog("COORDINATOR", "COORDINATOR_COMPLETE", {
    runId: metricsRun.analysisRunId,
    coordinatorType: "ami_orchestrator",
    recommendationId: executiveRecommendation.recommendationId,
    sourceMode,
    fallbackUsed: sourceFallbackUsed
  });

  amiLog("RUN", "RUN_COMPLETE", {
    runId: metricsRun.analysisRunId,
    status: usedFallback ? "completed_with_fallback" : "completed",
    sourceMode,
    fallbackUsed: sourceFallbackUsed
  });

  const result = AnalysisResultSchema.parse({
    ...metricsRun,
    status: usedFallback ? "completed_with_fallback" : "completed",
    completedAt,
    sourceMode,
    fallbackUsed: sourceFallbackUsed,
    sourceCollectionStatus: {
      ...metricsRun.sourceCollectionStatus,
      mode: sourceMode,
      usedFallback: sourceFallbackUsed,
      fallbackUsed: sourceFallbackUsed,
      demoSnapshotUsed: sourceMode === "demo_seed",
      liveProviderUsed: sourceMode === "live",
      sourceLabel: sourceModeLabel(sourceMode)
    },
    assistantStatus: assistantStatusRecord(agentStatus),
    agentStatus,
    agentRuns: outputs,
    synthesis: agentResult.synthesis,
    finalVerdict,
    assistantRunTrace,
    coordinatorTrace,
    externalActionPayload: finalVerdict.externalActionPayload,
    executiveRecommendation,
    opportunities: [executiveRecommendation, secondaryRecommendation(executiveRecommendation, metricsRun.marketContext)],
    assistantFindings: outputs.map((output) => findingFromOutput(output, sourceMode)),
    warnings,
    usedFallback,
    fallbackReason: sourceFallbackUsed ? metricsRun.fallbackReason : agentResult.usedFallback ? agentResult.warnings[0] : undefined,
    demoMode: sourceMode === "demo_seed"
  });

  writeRunArtifacts(result);
  return result;
}

export async function runAmiAnalysis(
  workspaceId: string,
  context: MarketContextPayload,
  inventoryContext: InventoryRunContext = { requested: context.useInventoryContext, available: context.useInventoryContext }
): Promise<AnalysisResult> {
  const metricsRun = await createAnalysisRunToMetrics(workspaceId, context, inventoryContext);
  return completeAnalysisRun(metricsRun);
}
