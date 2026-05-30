import { randomUUID } from "node:crypto";
import type { AgentOutput, EvidenceRef, RiskLevel, VerdictAgentOutput } from "@/lib/schemas/agents";
import type {
  AnalysisResult,
  AnalysisRunContract,
  AssistantRunTrace,
  AssistantContribution,
  AssistantFinding,
  CanonicalSourceMode,
  DataQuality,
  CoordinatorRunTrace,
  EvidenceLink,
  EvidencePackage,
  EvidenceTraceMetadata,
  MarketContextPayload,
  NormalizedProduct,
  NormalizedSourceMode,
  RawSourceSnapshotRecord,
  RawSourceStatus,
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
import { normalizeVisibleEvidenceItems, resolveSourceState, toHttpSourceUrl } from "@/lib/analysis/source-state";
import { amiDiagLog, briefingDiagFields, createDiagRequestId } from "@/lib/diagnostics/ami-diag";
import {
  amiLog,
  extractedProductFields,
  isSourceFallbackMode,
  normalizeSourceTrace,
  sourceModeLabel
} from "@/lib/analysis/source-trace";
import { writeRunArtifacts } from "@/lib/analysis/run-artifacts";
import { deriveSupplierSourceState, supplierMissingSignals, supplierSourceReason } from "@/lib/analysis/supplier-source-state";
import { collectBrightDataEvidence } from "@/lib/data-providers/brightdata/client";
import type { BrightDataCollectionResult } from "@/lib/data-providers/brightdata/types";
import { buildAgentStatus, buildGoalWorkflow, buildPendingAgentStatus, goalIntentFor, runAmiAgents, shouldRunSupplier } from "@/lib/agents/orchestrator";
import type { AgentContext } from "@/lib/agents/types";
import { confidence as confidenceFormula, fallbackPenalty, fieldCompleteness, sourceReliability, weightedAvailableScore } from "@/lib/agents/formulas";

export const INVENTORY_CONTEXT_UNAVAILABLE_WARNING =
  "Inventory context was requested, but no usable inventory source is connected. AMI continued using trend, competitor, and supplier signals.";

export type InventoryRunContext = {
  requested: boolean;
  available: boolean;
  warningMessage?: string;
  sourceLabel?: string;
};

type AnalysisDiagnostics = {
  requestId?: string;
  briefingFingerprint?: string;
};

const SPECIALIST_ASSISTANTS = ["inventory", "trend", "competitor", "supplier"] as const;
const VISIBLE_AGENTS = ["orchestrator", "inventory", "trend", "competitor", "supplier"] as const;

function sourceFallbackUsed(mode: SourceMode | NormalizedSourceMode) {
  return isSourceFallbackMode(mode);
}

function sourceDescriptionForMode(sourceMode: SourceMode | NormalizedSourceMode) {
  if (sourceMode === "live") {
    return "Bright Data live normalized evidence";
  }

  if (sourceMode === "fallback" || sourceMode === "fallback_snapshot") {
    return "Bright Data preserved raw snapshot evidence";
  }

  if (sourceMode === "demo" || sourceMode === "demo_seed") {
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

  if (sourceMode === "fallback" || sourceMode === "fallback_snapshot") {
    return "Bright Data fallback snapshot";
  }

  if (sourceMode === "demo" || sourceMode === "demo_seed" || sourceMode === "demo_fallback" || sourceMode === "demo_snapshot") {
    return "Demo seed data";
  }

  return "Provider status data";
}

function dataFreshnessForMode(sourceMode: SourceMode | NormalizedSourceMode) {
  if (sourceMode === "live") {
    return "Live Bright Data collection completed during this run";
  }

  if (sourceMode === "fallback" || sourceMode === "fallback_snapshot") {
    return "Preserved Bright Data raw snapshot loaded during this run";
  }

  if (sourceMode === "demo" || sourceMode === "demo_seed" || sourceMode === "demo_fallback" || sourceMode === "demo_snapshot") {
    return "Deterministic demo seed generated during this run";
  }

  return "Provider did not return live evidence";
}

function rawRefForCollection(collection: BrightDataCollectionResult) {
  return collection.rawSnapshotRefs[0] ?? (collection.rawSnapshotsSaved > 0 ? "mongo:rawSourceSnapshots" : undefined);
}

function firstHttpUrl(...values: unknown[]) {
  for (const value of values) {
    const url = toHttpSourceUrl(value);

    if (url) {
      return url;
    }
  }

  return null;
}

function evidenceLinkSourceType(sourceName: string | undefined, fallback: EvidenceLink["sourceType"]): EvidenceLink["sourceType"] {
  const normalized = sourceName?.toLowerCase() ?? "";

  if (normalized.includes("supplier") || normalized.includes("alibaba") || normalized.includes("aliexpress")) {
    return "supplier";
  }

  if (normalized.includes("trend") || normalized.includes("tiktok") || normalized.includes("facebook")) {
    return "trend";
  }

  if (normalized.includes("search") || normalized.includes("unlocker") || normalized.includes("serp")) {
    return "search";
  }

  return fallback;
}

function buildEvidenceLinks(
  evidencePackage: EvidencePackage,
  products: NormalizedProduct[],
  evidenceRefs: EvidenceRef[]
): EvidenceLink[] {
  const links: EvidenceLink[] = [];
  const seen = new Set<string>();
  const rawSourceSnapshotId = evidencePackage.rawSourceSnapshotId ?? evidencePackage.rawRef;

  function addLink(input: {
    label: string;
    url?: string | null;
    sourceName?: string;
    sourceType: EvidenceLink["sourceType"];
    sourceStatus?: EvidenceLink["sourceStatus"];
    lastSeenAt?: string;
    rawSourceSnapshotId?: string;
  }) {
    const url = toHttpSourceUrl(input.url);

    if (!url || seen.has(url)) {
      return;
    }

    seen.add(url);
    links.push({
      label: input.label,
      url,
      sourceName: input.sourceName ?? evidencePackage.sourceName ?? evidencePackage.sourceMarketplace,
      sourceType: input.sourceType,
      sourceStatus: input.sourceStatus,
      lastSeenAt: input.lastSeenAt ?? evidencePackage.lastSeenAt ?? evidencePackage.scrapedAt,
      rawSourceSnapshotId: input.rawSourceSnapshotId ?? rawSourceSnapshotId
    });
  }

  const evidencePackageUrl = firstHttpUrl(
    evidencePackage.productUrl,
    evidencePackage.marketplaceUrl,
    evidencePackage.sourceUrl,
    evidencePackage.url
  );

  addLink({
    label: evidenceLinkSourceType(evidencePackage.sourceName, "marketplace") === "search" ? "Open marketplace search" : "Review listing",
    url: evidencePackageUrl,
    sourceName: evidencePackage.sourceName ?? evidencePackage.sourceMarketplace,
    sourceType: evidenceLinkSourceType(evidencePackage.sourceName, "marketplace"),
    sourceStatus: evidencePackage.sourceStatus,
    lastSeenAt: evidencePackage.lastSeenAt ?? evidencePackage.scrapedAt,
    rawSourceSnapshotId
  });

  addLink({
    label: "View supplier source",
    url: evidencePackage.supplierUrl,
    sourceName: evidencePackage.sellerName ?? evidencePackage.sourceName ?? evidencePackage.sourceMarketplace,
    sourceType: "supplier",
    sourceStatus: evidencePackage.sourceStatus,
    lastSeenAt: evidencePackage.lastSeenAt ?? evidencePackage.scrapedAt,
    rawSourceSnapshotId
  });

  products.slice(0, 5).forEach((product) => {
    const productUrl = firstHttpUrl(product.productUrl, product.marketplaceUrl, product.sourceUrl);

    addLink({
      label: "View marketplace listing",
      url: productUrl,
      sourceName: product.source,
      sourceType: evidenceLinkSourceType(product.source, "marketplace"),
      sourceStatus: product.dataQuality?.sourceStatus,
      lastSeenAt: product.lastSeenAt ?? product.lastUpdated,
      rawSourceSnapshotId: product.rawSourceSnapshotId ?? rawSourceSnapshotId
    });

    addLink({
      label: "View supplier source",
      url: product.supplierUrl,
      sourceName: product.supplierName ?? product.source,
      sourceType: "supplier",
      sourceStatus: product.dataQuality?.sourceStatus,
      lastSeenAt: product.lastSeenAt ?? product.lastUpdated,
      rawSourceSnapshotId: product.rawSourceSnapshotId ?? rawSourceSnapshotId
    });
  });

  evidenceRefs.slice(0, 10).forEach((ref) => {
    addLink({
      label: "Open evidence",
      url: ref.url,
      sourceName: ref.sourceType || ref.source,
      sourceType: evidenceLinkSourceType(ref.sourceType, "search"),
      sourceStatus: undefined,
      lastSeenAt: ref.collectedAt,
      rawSourceSnapshotId
    });
  });

  return links;
}

function rawStatusFromDataQuality(dataQuality: DataQuality): RawSourceStatus {
  if (dataQuality.status === "failed") {
    return "failed";
  }

  if (dataQuality.status === "success") {
    return "success";
  }

  return "partial";
}

function sourceCollectionEventFor(status: RawSourceStatus) {
  if (status === "success") {
    return "source_collection_completed";
  }

  if (status === "partial") {
    return "source_collection_partial";
  }

  if (status === "empty") {
    return "source_collection_empty";
  }

  return "source_collection_failed";
}

function logSourceRoleCollection(details: {
  requestId: string;
  analysisRunId: string;
  context: MarketContextPayload;
  briefingFingerprint: string;
  sourceName: string;
  sourceRole: "marketplace_demand" | "trend_signal" | "supplier_feasibility" | "inventory_context" | "orchestrator_synthesis";
  sourceStatus: RawSourceStatus;
  recordCount: number;
  usedFallback: boolean;
  fallbackReason?: string;
  missingCriticalFields?: string[];
}) {
  amiDiagLog(sourceCollectionEventFor(details.sourceStatus), {
    requestId: details.requestId,
    analysisRunId: details.analysisRunId,
    briefingFingerprint: details.briefingFingerprint,
    businessGoal: details.context.businessGoal,
    productFamily: details.context.productName,
    requestedProductFamily: details.context.productName,
    category: details.context.category,
    requestedCategory: details.context.category,
    targetMarketplace: details.context.targetMarketplace,
    sourceName: details.sourceName,
    sourceRole: details.sourceRole,
    sourceStatus: details.sourceStatus,
    recordCount: details.recordCount,
    usedFallback: details.usedFallback,
    fallbackReason: details.fallbackReason,
    missingCriticalFields: details.missingCriticalFields,
    completedAt: new Date().toISOString()
  });
}

function sourceNameForCollection(collection: BrightDataCollectionResult) {
  return collection.sourceProducts[0] ?? collection.brightDataProduct;
}

function canonicalModeForCollection(collection: BrightDataCollectionResult): {
  mode: "live" | "demo" | "fallback";
  sourceMode: CanonicalSourceMode;
} {
  if (collection.status === "live" && !collection.usedFallback) {
    return { mode: "live", sourceMode: "live" };
  }

  if (collection.fallbackKind === "demo_seed" && !collection.liveAttempted) {
    return { mode: "demo", sourceMode: "demo" };
  }

  if (collection.usedFallback && collection.liveAttempted) {
    return { mode: "fallback", sourceMode: "mixed" };
  }

  if (collection.usedFallback) {
    return { mode: "fallback", sourceMode: collection.fallbackKind === "snapshot" ? "mixed" : "demo" };
  }

  return { mode: "live", sourceMode: "live" };
}

function sourceKeyForAttempt(attempt: BrightDataCollectionResult["attempts"][number]) {
  const raw = attempt.sourceName ?? attempt.marketplace ?? attempt.product;
  return raw
    .toLowerCase()
    .replace(/bright data\s*/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function rawStatusForAttempt(status: BrightDataCollectionResult["attempts"][number]["status"]): RawSourceStatus | null {
  if (status === "skipped") {
    return null;
  }

  return status;
}

function buildRawSourceSnapshots(runId: string, collection: BrightDataCollectionResult): RawSourceSnapshotRecord[] {
  const receivedAt = collection.collectedAt;
  const snapshots: RawSourceSnapshotRecord[] = [];

  for (const attempt of collection.attempts) {
    const status = rawStatusForAttempt(attempt.status);

    if (!status) {
      continue;
    }

    const source = sourceKeyForAttempt(attempt);

    snapshots.push({
      rawSourceSnapshotId: `${runId}:${source}:${status}`,
      analysisRunId: runId,
      source,
      status,
      ...(attempt.sourceUrl ? { sourceUrl: attempt.sourceUrl } : {}),
      errorCode:
        status === "failed"
          ? "scraper_failed"
          : status === "empty"
            ? "empty_result"
            : status === "partial"
              ? "missing_fields"
              : null,
      errorMessage: attempt.safeError ?? (status === "partial" ? attempt.message : null),
      input: {
        marketplace: attempt.marketplace,
        inputType: attempt.inputType,
        operation: attempt.operation,
        datasetId: attempt.datasetId,
        snapshotId: attempt.snapshotId,
        sourceUrl: attempt.sourceUrl
      },
      recordCount: attempt.recordCount ?? 0,
      receivedAt,
      ...(attempt.snapshotId ? { rawPayloadRef: `brightdata:snapshot:${attempt.snapshotId}` } : {})
    });
  }

  if (collection.usedFallback) {
    snapshots.push({
      rawSourceSnapshotId: `${runId}:fallback:${collection.fallbackKind}`,
      analysisRunId: runId,
      source: "fallback",
      status: collection.products.length ? "partial" : "empty",
      errorCode: collection.fallbackKind,
      errorMessage: collection.fallbackReason ?? null,
      input: {
        fallbackKind: collection.fallbackKind,
        liveAttempted: collection.liveAttempted
      },
      recordCount: collection.products.length,
      receivedAt,
      ...(collection.rawSnapshotRefs[0] ? { rawPayloadRef: collection.rawSnapshotRefs[0] } : {})
    });
  }

  return snapshots;
}

function buildRawSourceSummary(rawSourceSnapshots: RawSourceSnapshotRecord[]) {
  return rawSourceSnapshots.reduce(
    (summary, snapshot) => {
      summary[snapshot.status].push(snapshot.source);
      return summary;
    },
    { success: [] as string[], partial: [] as string[], empty: [] as string[], failed: [] as string[] }
  );
}

function buildDataQualitySummary(collection: BrightDataCollectionResult, products: NormalizedProduct[]): DataQuality {
  const rawSourceSnapshots = buildRawSourceSnapshots("preview", collection);
  const rawFailedSources = rawSourceSnapshots.filter((snapshot) => snapshot.status === "failed").map((snapshot) => snapshot.source);
  // Attempt-level failures are only surfaced as "failed" when no product records were collected.
  // When products exist (another path succeeded), those attempts are downgraded to partial — they
  // represent incomplete coverage, not a blocking data failure.
  const failedSources = products.length > 0 ? [] : rawFailedSources;
  const partialSources = [
    ...rawSourceSnapshots.filter((snapshot) => snapshot.status === "partial").map((snapshot) => snapshot.source),
    ...(products.length > 0 ? rawFailedSources : [])
  ];
  const emptySources = rawSourceSnapshots.filter((snapshot) => snapshot.status === "empty").map((snapshot) => snapshot.source);
  const missingCriticalFields = Array.from(
    new Set(products.flatMap((product) => product.dataQuality?.missingFields ?? []).filter(Boolean))
  );
  const fallbacksUsed = collection.usedFallback
    ? [
        collection.fallbackKind === "snapshot" ? "bright_data_preserved_raw_snapshot" : "deterministic_demo_seed",
        ...products.flatMap((product) => product.dataQuality?.fallbackFields ?? [])
      ]
    : products.flatMap((product) => product.dataQuality?.fallbackFields ?? []);
  const criticalFallbackPenalty = fallbackPenalty(fallbacksUsed.length);
  const failedPenalty = Math.min(rawFailedSources.length * 0.08, 0.24);
  const completeness = fieldCompleteness(Math.max(0, 4 - missingCriticalFields.length), 4);
  const reliability = weightedAvailableScore(
    rawSourceSnapshots.length
      ? rawSourceSnapshots.map((snapshot) => ({ value: sourceReliability(snapshot.status), weight: 1 }))
      : [{ value: collection.status === "live" ? 1 : collection.usedFallback ? 0.45 : 0.5, weight: 1 }]
  );
  const confidenceScore = confidenceFormula({
    fieldCompleteness: completeness,
    sourceReliability: reliability,
    sourceFreshness: collection.liveSucceeded ? 1 : 0.65,
    matchQuality: products[0]?.matchConfidence ?? null,
    agentAgreement: 0.75,
    fallbackPenalty: criticalFallbackPenalty + failedPenalty,
    contradictionPenalty: 0
  });
  const status: DataQuality["status"] =
    failedSources.length && !products.length
      ? "failed"
      : failedSources.length || collection.usedFallback
        ? "degraded"
        : partialSources.length || emptySources.length || missingCriticalFields.length
          ? "partial"
          : "success";

  return {
    status,
    failedSources,
    partialSources,
    emptySources,
    fallbacksUsed: Array.from(new Set(fallbacksUsed)),
    missingCriticalFields,
    confidencePenaltyApplied: Number(Math.min(0.5, criticalFallbackPenalty + failedPenalty + (confidenceScore === null ? 0 : Math.max(0, 0.75 - confidenceScore))).toFixed(2)),
    sourceReliability: reliability,
    fieldCompleteness: completeness,
    sourceFreshness: collection.liveSucceeded ? 1 : 0.65,
    matchQuality: products[0]?.matchConfidence ?? null,
    agentAgreement: 0.75
  };
}

function buildAnalysisRunContract(
  workspaceId: string,
  runId: string,
  context: MarketContextPayload,
  status: AnalysisResult["status"],
  collection: BrightDataCollectionResult,
  startedAt: string,
  completedAt?: string
): AnalysisRunContract {
  const canonicalMode = canonicalModeForCollection(collection);
  const now = completedAt ?? new Date().toISOString();

  return {
    analysisRunId: runId,
    workspaceId,
    businessGoal: context.businessGoal,
    goalIntent: goalIntentFor(context.businessGoal),
    inputContext: context,
    status,
    mode: canonicalMode.mode,
    sourceMode: canonicalMode.sourceMode,
    startedAt,
    completedAt,
    createdAt: startedAt,
    updatedAt: now
  };
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
    const sourceUrl = firstHttpUrl(ref.url, product?.sourceUrl, product?.productUrl, product?.marketplaceUrl);
    const productUrl = firstHttpUrl(product?.productUrl, sourceUrl);
    const marketplaceUrl = firstHttpUrl(product?.marketplaceUrl, sourceUrl);
    const supplierUrl = firstHttpUrl(product?.supplierUrl);
    const rawSourceSnapshotId = product?.rawSourceSnapshotId ?? rawRef;

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
      ...(sourceUrl ? { sourceUrl } : {}),
      ...(productUrl ? { productUrl } : {}),
      ...(marketplaceUrl ? { marketplaceUrl } : {}),
      ...(supplierUrl ? { supplierUrl } : {}),
      ...(product?.imageUrl ? { imageUrl: product.imageUrl } : {}),
      title: product?.title ?? ref.label,
      price: product?.priceUsd ?? product?.price,
      currency: product?.currency,
      rating: product?.rating,
      reviewsCount: product?.reviewsCount,
      availability: product?.availability,
      sellerName: product?.supplierName,
      category: product?.category,
      ...(rawSourceSnapshotId ? { rawSourceSnapshotId } : {}),
      ...(rawRef ? { rawRef } : {}),
      capturedAt: ref.collectedAt ?? collection.collectedAt,
      lastSeenAt: product?.lastSeenAt ?? product?.lastUpdated ?? ref.collectedAt ?? collection.collectedAt,
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
  context: MarketContextPayload,
  workflow: AgentContext["workflow"],
  dataQuality: DataQuality | undefined,
  startedAt: string,
  completedAt: string
): AssistantRunTrace[] {
  const sourceDescriptions = sourceSummary?.productsUsed.length
    ? sourceSummary.productsUsed
    : [sourceDescriptionForMode(sourceSummary?.fallbackUsed ? "demo_seed" : "live")];

  return workflow.map((step) => {
    const output = outputs.find((candidate) => candidate.agentType === step.agentType);
    const status = output?.status ?? (step.optional ? "skipped" : "failed");
    const fallbackSignals = [
      ...(output?.status === "fallback" ? ["deterministic_agent_fallback"] : []),
      ...(dataQuality?.fallbacksUsed ?? [])
    ];

    return {
      runId,
      analysisRunId: runId,
      assistantRunId: `${runId}:${step.agentType}`,
      agent: step.agentType,
      assistantType: step.agentType,
      businessGoal: context.businessGoal,
      goalIntent: step.goalIntent,
      status,
      executionOrder: step.executionOrder,
      startedAt,
      completedAt,
      sourcesUsed: sourceDescriptions,
      inputRefs: [],
      outputRef: output ? `${runId}:${step.agentType}:output` : undefined,
      missingSignals: dataQuality?.missingCriticalFields ?? [],
      fallbackSignals,
      confidenceAdjustment: {
        fieldCompleteness: dataQuality?.fieldCompleteness,
        sourceReliability: dataQuality?.sourceReliability,
        fallbackPenalty: dataQuality?.confidencePenaltyApplied
      },
      dataSourcesUsed: sourceDescriptions,
      evidenceIds: evidenceIdsFromOutput(output),
      latestContribution: output && "finding" in output ? output.finding : output && "finalVerdict" in output ? output.finalVerdict : undefined,
      usageEstimate: step.agentType === "trend" ? 0.4 : step.agentType === "inventory" ? 0.3 : step.agentType === "orchestrator" ? 1 : 0.5,
      warning:
        status === "skipped"
          ? "Assistant was optional for this business goal and AMI did not need it."
          : output?.status === "fallback"
            ? "Assistant used deterministic fallback output."
            : undefined
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
  sourceMode: SourceMode,
  fallbackUsed: boolean,
  startedAt: string,
  completedAt: string
): CoordinatorRunTrace {
  const verdict = outputs.find((output) => output.agentType === "orchestrator");

  return {
    runId,
    coordinatorRunId: `${runId}:ami_orchestrator`,
    coordinatorType: "ami_orchestrator",
    status: verdict?.status ?? "completed",
    startedAt,
    completedAt,
    assistantRunIds: VISIBLE_AGENTS.map((assistantType) => `${runId}:${assistantType}`),
    evidenceIds: outputs.flatMap((output) => evidenceIdsFromOutput(output)),
    finalRecommendationId: recommendationId,
    reasoningSummary:
      verdict && "reasoning" in verdict
          ? verdict.reasoning
          : "AMI orchestrator synthesized specialist outputs into the final recommendation.",
    assistantContributionSummary: Object.fromEntries(
      VISIBLE_AGENTS.map((assistantType) => {
        const output = outputs.find((candidate) => candidate.agentType === assistantType);
        return [
          assistantType,
          output && "finding" in output
            ? output.finding
            : output && "finalVerdict" in output
              ? output.finalVerdict
              : "No agent output recorded."
        ];
      })
    ),
    confidence: verdict && "confidence" in verdict ? verdict.confidence : undefined,
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
    agentType: "orchestrator",
    status: "fallback",
    finalVerdict: "AMI preliminary metrics are ready; final AI verdict is still pending.",
    recommendedAction: `Continue monitoring ${context.productName} until the AMI Orchestrator completes.`,
    reasoning: "The API has completed Bright Data collection, normalization, KPI extraction, and graph preparation.",
    confidence: 0.55,
    riskLevel: "medium",
    nextStep: "Poll this analysis run for the final AMI orchestrator verdict.",
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

// Supplier-native datasets the pipeline knows how to plan, mapped to the env var
// that holds each dataset id. `planned` reflects which are configured in this
// environment. Reading env presence is dry/local-safe — it triggers no collection.
const SUPPLIER_NATIVE_DATASET_ENV: ReadonlyArray<{ key: string; envs: string[] }> = [
  { key: "alibaba", envs: ["BRIGHT_DATA_ALIBABA_PRODUCTS_DATASET_ID"] },
  { key: "aliexpress", envs: ["BRIGHT_DATA_ALIEXPRESS_PRODUCTS_DATASET_ID"] },
  // eBay accepts the current name plus the legacy alias (see brightdata/client.ts).
  { key: "ebay", envs: ["BRIGHT_DATA_EBAY_KEYWORD_DATASET_ID", "BRIGHT_DATA_EBAY_DATASET_ID"] }
];

function plannedSupplierNativeSources(): string[] {
  return SUPPLIER_NATIVE_DATASET_ENV
    .filter(({ envs }) => envs.some((env) => Boolean(process.env[env]?.trim())))
    .map(({ key }) => key);
}

function buildSupplierOptions(context: MarketContextPayload, products: NormalizedProduct[]): SupplierOption[] {
  const seen = new Set<string>();

  const hasNonBlank = (value: unknown): boolean => typeof value === "string" && value.trim().length > 0;
  const hasPositiveSupplierPrice = (product: NormalizedProduct) =>
    product.supplierPrice !== undefined && product.supplierPrice !== null && Number.isFinite(product.supplierPrice) && product.supplierPrice > 0;
  const isPlaceholderSupplierName = (value: unknown) =>
    !hasNonBlank(value) || /verified supplier catalog|web unlocker|amazon products search|marketplace search|demo seed|fallback/i.test(String(value));
  const sourceText = (product: NormalizedProduct) =>
    [
      product.source,
      product.sourceUrl,
      product.productUrl,
      product.marketplaceUrl,
      product.supplierUrl,
      context.targetMarketplace
    ]
      .filter((value): value is string => hasNonBlank(value))
      .join(" ")
      .toLowerCase();
  const isPrimarySupplierSource = (product: NormalizedProduct) =>
    /alibaba|aliexpress|1688\.com|dhgate|made-in-china|globalsources|indiamart/.test(sourceText(product));
  const isEbayFallback = (product: NormalizedProduct) => /ebay/.test(sourceText(product));
  const isAmazonSellerFallback = (product: NormalizedProduct) =>
    /amazon/.test(sourceText(product)) &&
    (!isPlaceholderSupplierName(product.supplierName) || Boolean(product.supplierUrl) || hasPositiveSupplierPrice(product));
  const isWebUnlockerFallback = (product: NormalizedProduct) =>
    /web unlocker/.test(sourceText(product)) &&
    (!isPlaceholderSupplierName(product.supplierName) || Boolean(product.supplierUrl) || hasPositiveSupplierPrice(product));
  const isFallbackSupplierSource = (product: NormalizedProduct) =>
    isEbayFallback(product) || isAmazonSellerFallback(product) || isWebUnlockerFallback(product) || isSourceFallbackMode(product.source);
  const isSupplierOrFallbackSource = (product: NormalizedProduct) => isPrimarySupplierSource(product) || isFallbackSupplierSource(product);
  const hasSupplierIdentity = (product: NormalizedProduct) =>
    isSupplierOrFallbackSource(product) ||
    !isPlaceholderSupplierName(product.supplierName) ||
    Boolean(product.supplierUrl);
  const hasRealSupplierEvidence = (product: NormalizedProduct) =>
    hasPositiveSupplierPrice(product) ||
    hasNonBlank(product.estimatedDeliveryTime) ||
    hasNonBlank(product.availability) ||
    (product.estimatedDeliveryDays !== undefined && product.estimatedDeliveryDays !== null && Number.isFinite(product.estimatedDeliveryDays)) ||
    (product.rating !== undefined && product.rating !== null && Number.isFinite(product.rating)) ||
    (product.reviewsCount !== undefined && product.reviewsCount !== null && Number.isFinite(product.reviewsCount)) ||
    hasNonBlank(product.supplierUrl) ||
    (isSupplierOrFallbackSource(product) && Boolean(product.sourceUrl || product.productUrl || product.rawSourceSnapshotId));
  const supplierSourceLabel = (product: NormalizedProduct) => {
    const text = sourceText(product);
    if (/alibaba|1688\.com/.test(text)) return "Alibaba supplier source";
    if (/aliexpress/.test(text)) return "AliExpress supplier source";
    if (/dhgate/.test(text)) return "DHgate supplier source";
    if (/made-in-china/.test(text)) return "Made-in-China supplier source";
    if (/globalsources/.test(text)) return "GlobalSources supplier source";
    if (/indiamart/.test(text)) return "IndiaMART supplier source";
    if (isEbayFallback(product)) return "eBay fallback supplier signal";
    if (isAmazonSellerFallback(product)) return "Amazon seller fallback";
    if (isWebUnlockerFallback(product)) return "Web Unlocker fallback";
    if (isSourceFallbackMode(product.source)) return "Fallback supplier signal";
    return product.source;
  };

  return products
    .filter((product) => {
      // A) Supplier identity/source signal exists
      if (!hasSupplierIdentity(product)) return false;

      // B) At least one real supplier evidence signal exists (partial evidence allowed)
      if (!hasRealSupplierEvidence(product)) return false;

      return true;
    })
    .map((product, index) => {
      const isFallback = !isPrimarySupplierSource(product) || isFallbackSupplierSource(product);

      const hasDelivery = hasNonBlank(product.estimatedDeliveryTime);
      const hasAvailability = hasNonBlank(product.availability);
      const rating = product.rating !== undefined && product.rating !== null ? Number(product.rating) : Number.NaN;
      const hasRating = Number.isFinite(rating);
      const supplierName = isPlaceholderSupplierName(product.supplierName)
        ? isFallback
          ? "Fallback supplier signal"
          : "Supplier validation required"
        : product.supplierName;

      return {
        supplierName: supplierName ?? `${supplierSourceLabel(product)} option ${index + 1}`,
        source: supplierSourceLabel(product),
        ...(product.externalId ? { externalId: product.externalId } : {}),
        evidenceRefIds: product.evidenceRefs,
        ...(product.sourceUrl ? { sourceUrl: product.sourceUrl } : {}),
        ...(product.productUrl ? { productUrl: product.productUrl } : {}),
        ...(product.supplierUrl ? { supplierUrl: product.supplierUrl } : {}),
        ...(product.rawSourceSnapshotId ? { rawSourceSnapshotId: product.rawSourceSnapshotId } : {}),
        lastSeenAt: product.lastSeenAt ?? product.lastUpdated,
        estimatedUnitCost: hasPositiveSupplierPrice(product) ? product.supplierPrice ?? null : null,
        // SupplierOptionSchema requires these strings; use explicit "Unknown" only when the real field is missing.
        estimatedDeliveryTime: hasDelivery ? (product.estimatedDeliveryTime as string) : "Unknown delivery time (not provided)",
        availability: hasAvailability ? (product.availability as string) : "Unknown availability (not provided)",
        ratingQualityProxy: hasRating ? `${rating.toFixed(1)} / 5 rating proxy` : "Unknown rating (not provided)",
        matchConfidence: confidenceLevel(product.matchConfidence ?? 0.6),
        risk: riskForLegacy((product.riskScore ?? 50) >= 75 ? "high" : (product.riskScore ?? 50) >= 45 ? "medium" : "low"),
        isFallback
      };
    })
    .filter((supplier) => {
      const key = [
        supplier.externalId,
        supplier.evidenceRefIds.join("|"),
        supplier.rawSourceSnapshotId,
        supplier.supplierUrl,
        supplier.productUrl,
        supplier.sourceUrl,
        supplier.supplierName,
        supplier.estimatedUnitCost
      ]
        .filter(Boolean)
        .join("::");

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
    orchestrator: 1,
    trend: 0.4,
    competitor: 0.5,
    supplier: 0.5,
    inventory: 0.3
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
  sourceEvidenceRefs: EvidenceRef[],
  sourceMode: SourceMode,
  outputs: AgentOutput[],
  metricMap: Record<string, number | null>,
  dataQuality?: DataQuality
): Recommendation {
  const primary = products[0];
  const scoreByGoal = (metricMap: Record<string, number | null | undefined>) => {
    if (context.businessGoal === "stock_optimization") {
      const action = metricMap.stockActionScore;
      const protection = metricMap.stockProtectionScore;
      return typeof action === "number" && typeof protection === "number" ? Math.max(action, protection) : action ?? protection ?? null;
    }

    if (context.businessGoal === "revenue_stock_opportunities") {
      return metricMap.revenueOpportunityScore ?? null;
    }

    return metricMap.discoverOpportunityScore ?? null;
  };
  const finalScore = scoreByGoal(metricMap) ?? Math.min(1, Math.max(0, (primary?.demandSignal ?? 60) / 100 * 0.35 + (primary?.estimatedMargin ?? 35) / 100 * 0.45));
  const agentContributions = {
    orchestrator: verdict.reasoning,
    inventoryInitial: outputs.find((output) => output.agentType === "inventory" && "finding" in output)?.finding,
    inventoryFinal: outputs.find((output) => output.agentType === "inventory" && "suggestedAction" in output)?.suggestedAction,
    trend: outputs.find((output) => output.agentType === "trend" && "finding" in output)?.finding,
    competitor: outputs.find((output) => output.agentType === "competitor" && "finding" in output)?.finding,
    supplier: outputs.find((output) => output.agentType === "supplier" && "finding" in output)?.finding
  };
  const recommendationDataQuality =
    dataQuality ?? {
      status: sourceFallbackUsed(sourceMode) ? "degraded" : "success",
      failedSources: [],
      partialSources: [],
      emptySources: [],
      fallbacksUsed: sourceFallbackUsed(sourceMode) ? [sourceDescriptionForMode(sourceMode)] : [],
      missingCriticalFields: [],
      confidencePenaltyApplied: sourceFallbackUsed(sourceMode) ? 0.08 : 0,
      sourceReliability: sourceFallbackUsed(sourceMode) ? 0.45 : 1,
      fieldCompleteness: 1,
      sourceFreshness: sourceMode === "live" ? 1 : 0.65,
      matchQuality: primary?.matchConfidence ?? null,
      agentAgreement: 0.75
    } satisfies DataQuality;
  const opportunityType =
    context.businessGoal === "stock_optimization"
      ? "operational_stock_decision"
      : context.businessGoal === "revenue_stock_opportunities"
        ? "revenue_or_margin_expansion"
        : "new_product_or_sourcing_validation";
  const normalizedRequestedCategory = context.category.trim().toLowerCase();
  const normalizedCandidateCategory = primary?.category?.trim().toLowerCase() ?? "";
  const categoryFit =
    normalizedCandidateCategory && normalizedRequestedCategory
      ? normalizedCandidateCategory.includes(normalizedRequestedCategory) || normalizedRequestedCategory.includes(normalizedCandidateCategory)
        ? 0.9
        : 0.45
      : null;
  const productFamilyFit = primary?.matchConfidence ?? null;
  const lowFit =
    (productFamilyFit !== null && productFamilyFit < 0.65) ||
    (categoryFit !== null && categoryFit < 0.5);
  const validationOnly = lowFit && (sourceFallbackUsed(sourceMode) || recommendationDataQuality.status !== "success");
  const adjustedFinalScore = validationOnly ? Math.min(finalScore, 0.55) : finalScore;
  const adjustedConfidence = Math.max(
    0,
    Math.min(1, verdict.confidence - (recommendationDataQuality.confidencePenaltyApplied ?? 0) - (validationOnly ? 0.2 : 0))
  );
  const adjustedRisk = validationOnly ? "high" : riskForLegacy(verdict.riskLevel);
  const adjustedAction = validationOnly
    ? `Validate ${context.productName} fit before acting on this opportunity`
    : verdict.recommendedAction;
  const adjustedReasoning = validationOnly
    ? "AMI could not fully validate live product-family fit for the requested briefing. Treat this result as validation-only because the selected evidence came from broader or degraded source data."
    : verdict.reasoning;
  const adjustedNextStep = validationOnly
    ? "Run a fresh live marketplace search or confirm supplier and marketplace evidence before purchase, listing, or promotion decisions."
    : verdict.nextStep;
  const evidenceLinks = buildEvidenceLinks(evidencePackage, products, sourceEvidenceRefs);
  const sourceUrls = evidenceLinks.filter((link) => link.sourceType === "marketplace" || link.sourceType === "search");

  amiDiagLog("analysis_candidate_selected", {
    analysisRunId,
    businessGoal: context.businessGoal,
    requestedProductFamily: context.productName,
    requestedCategory: context.category,
    candidateTitle: primary?.title,
    candidateCategory: primary?.category,
    candidateSource: primary?.source,
    productFamilyFit,
    categoryFit,
    finalMatchScore: metricMap.finalMatchScore ?? null,
    demandScore: metricMap.demandScore ?? null,
    trendMomentum: metricMap.trendMomentum ?? null,
    supplierAvailability: metricMap.supplierAvailabilityScore ?? null,
    sourceMode,
    usedFallback: sourceFallbackUsed(sourceMode),
    dataQualityStatus: recommendationDataQuality.status
  });

  return RecommendationSchema.parse({
    recommendationId: randomUUID(),
    analysisRunId,
    workspaceId,
    businessGoal: context.businessGoal,
    recommendedAction: adjustedAction,
    opportunityType: validationOnly ? "validation_only_low_fit" : opportunityType,
    finalScore: adjustedFinalScore,
    confidence: adjustedConfidence,
    risk: adjustedRisk,
    reasoningSummary: adjustedReasoning,
    metrics: metricMap,
    agentContributions,
    dataQuality: recommendationDataQuality,
    evidenceRefs: evidencePackage ? [evidencePackage.evidencePackageId, ...products.flatMap((product) => product.evidenceRefs)].filter(Boolean) : [],
    evidenceLinks,
    sourceUrls,
    primarySourceUrl: evidenceLinks[0]?.url ?? null,
    opportunityScore: Math.round(adjustedFinalScore * 100),
    estimatedMargin: primary?.estimatedMargin ?? evidencePackage.estimatedMargin ?? 0,
    demandSignal: signalLevel(primary?.demandSignal ?? 55),
    riskLevel: adjustedRisk,
    confidenceLevel: confidenceLevel(adjustedConfidence),
    signalStrength: signalLevel(primary?.trendMomentum ?? 55),
    dataFreshness: dataFreshnessForMode(sourceMode),
    matchQuality: confidenceLevel(primary?.matchConfidence ?? 0.6),
    primaryReason: adjustedReasoning,
    suggestedNextStep: adjustedNextStep,
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
  inventoryContext: InventoryRunContext = { requested: context.useInventoryContext, available: context.useInventoryContext },
  diagnostics: AnalysisDiagnostics = {}
): Promise<AnalysisResult> {
  const analysisRunId = randomUUID();
  const startedAt = new Date().toISOString();
  const requestId = diagnostics.requestId ?? createDiagRequestId("analysis_metrics");
  const diagContext = {
    ...briefingDiagFields(context, workspaceId),
    briefingFingerprint: diagnostics.briefingFingerprint ?? briefingDiagFields(context, workspaceId).briefingFingerprint
  };
  amiDiagLog("analysis_metrics_run_created", {
    requestId,
    analysisRunId,
    startedAt,
    ...diagContext
  });
  amiLog("RUN", "RUN_CREATED", {
    runId: analysisRunId,
    workspaceId,
    marketplace: context.targetMarketplace,
    product: context.productName
  });
  amiDiagLog("analysis_source_collection_started", {
    requestId,
    analysisRunId,
    startedAt: new Date().toISOString(),
    sourceRole: "marketplace_demand",
    ...diagContext
  });
  const collection = await collectBrightDataEvidence(context, undefined, {
    requestId,
    analysisRunId,
    briefingFingerprint: diagContext.briefingFingerprint
  });
  amiDiagLog("analysis_source_collection_completed", {
    requestId,
    analysisRunId,
    completedAt: new Date().toISOString(),
    sourceStatus: collection.status,
    usedFallback: collection.usedFallback,
    fallbackReason: collection.fallbackReason,
    sourceName: sourceNameForCollection(collection),
    sourceRole: "marketplace_demand",
    sourceMode: collection.status,
    recordCount: collection.products.length
  });

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
  const initialStatus: AnalysisResult["status"] = collection.products.length ? "metrics_ready" : "failed";
  const rawSourceSnapshots = buildRawSourceSnapshots(analysisRunId, collection);
  const rawSourceSummary = buildRawSourceSummary(rawSourceSnapshots);
  const dataQualitySummary = buildDataQualitySummary(collection, collection.products);
  const roleSourceStatus = rawStatusFromDataQuality(dataQualitySummary);
  for (const [sourceRole, sourceName] of [
    ["trend_signal", "Normalized marketplace evidence for Trend Assistant"],
    ["supplier_feasibility", "Normalized supplier feasibility proxy"],
    ["orchestrator_synthesis", "AMI Orchestrator normalized evidence"]
  ] as const) {
    logSourceRoleCollection({
      requestId,
      analysisRunId,
      context,
      briefingFingerprint: diagContext.briefingFingerprint,
      sourceName,
      sourceRole,
      sourceStatus: roleSourceStatus,
      recordCount: collection.products.length,
      usedFallback: collection.usedFallback,
      fallbackReason: collection.fallbackReason,
      missingCriticalFields: dataQualitySummary.missingCriticalFields
    });
  }
  logSourceRoleCollection({
    requestId,
    analysisRunId,
    context,
    briefingFingerprint: diagContext.briefingFingerprint,
    sourceName: inventoryContext.available
      ? inventoryContext.sourceLabel ?? "Connected inventory context"
      : inventoryContext.requested
        ? "Inventory context unavailable"
        : "Inventory context not requested",
    sourceRole: "inventory_context",
    sourceStatus: inventoryContext.available ? "success" : "empty",
    recordCount: inventoryContext.available ? 1 : 0,
    usedFallback: false,
    fallbackReason: inventoryContext.warningMessage
  });
  const analysisRun = buildAnalysisRunContract(workspaceId, analysisRunId, context, initialStatus, collection, startedAt);
  const resultSourceMode = analysisRun.sourceMode;
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
    collection.evidenceRefs,
    resultSourceMode,
    pendingOutputs,
    metrics.canonicalMetrics,
    dataQualitySummary
  );
  const secondary = secondaryRecommendation(executiveRecommendation, context);
  const agentStatus = buildPendingAgentStatus(context.businessGoal);
  const sourceProof = normalizeVisibleEvidenceItems(collection.evidenceRefs, sourceState, collection.collectedAt);
  const warnings = [
    ...collection.warnings,
    inventoryContext.warningMessage
  ].filter((warning): warning is string => Boolean(warning));

  // Authoritative supplier-native source state. Derived from the sources actually
  // attempted (rawSourceSummary / dataQualitySummary) + supplierOptions — never
  // from supplierOptions.length. No external calls; no supplier cost is invented.
  const supplierOptions = buildSupplierOptions(context, collection.products);
  const supplierSourcesPlanned = plannedSupplierNativeSources();
  const supplierState = deriveSupplierSourceState({ supplierOptions, dataQualitySummary, rawSourceSummary });
  const supplierMissing = supplierMissingSignals({ supplierOptions });
  const supplierReason = supplierSourceReason(supplierState);

  const result = AnalysisResultSchema.parse({
    analysisRunId,
    workspaceId,
    analysisRun,
    marketContext: context,
    status: initialStatus,
    startedAt,
    sourceMode: resultSourceMode,
    fallbackUsed,
    sourceProvider,
    sourceProducts,
    sourceSummary,
    rawSourceSnapshots,
    rawSourceSummary,
    dataQualitySummary,
    rawSnapshotMetadata,
    evidenceMetadata,
    assistantRunTrace: [],
    coordinatorTrace: undefined,
    assistantStatus: assistantStatusRecord(agentStatus),
    sourceCollectionStatus: {
      brightDataProduct: collection.brightDataProduct,
      mode: resultSourceMode,
      label: collection.label,
      collectedAt: collection.collectedAt,
      providerStatus: sourceState.providerStatus,
      usedFallback: fallbackUsed,
      fallbackUsed,
      demoSnapshotUsed: analysisRun.mode === "demo",
      liveProviderUsed: analysisRun.mode === "live",
      sourceLabel: sourceModeLabel(resultSourceMode),
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
    assistantRuns: [],
    agentRuns: [],
    synthesis: undefined,
    finalVerdict: undefined,
    externalActionPayload: pendingVerdict.externalActionPayload,
    usedFallback: fallbackUsed,
    fallbackReason: fallbackUsed || collection.status === "error" || collection.status === "not_configured" ? collection.fallbackReason : undefined,
    executiveRecommendation,
    recommendations: [executiveRecommendation, secondary],
    opportunities: [executiveRecommendation, secondary],
    assistantFindings: [],
    evidencePackages,
    supplierOptions,
    supplierSourceStatus: supplierState.status,
    supplierSourcesPlanned,
    supplierSourcesAttempted: supplierState.attempted,
    supplierMissingSignals: supplierMissing,
    supplierSourceReason: supplierReason,
    warnings,
    demoMode: analysisRun.mode === "demo"
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

  const workflow = buildGoalWorkflow(metricsRun.marketContext.businessGoal, {
    supplierNeeded: shouldRunSupplier({ briefing: metricsRun.marketContext, metrics })
  });
  const dataQuality = metricsRun.dataQualitySummary ?? {
    status: "success",
    failedSources: [],
    partialSources: [],
    emptySources: [],
    fallbacksUsed: [],
    missingCriticalFields: [],
    confidencePenaltyApplied: 0,
    sourceReliability: 1,
    fieldCompleteness: 1,
    sourceFreshness: 1,
    matchQuality: null,
    agentAgreement: 0.75
  } satisfies DataQuality;
  const agentContext: AgentContext = {
    analysisRunId: metricsRun.analysisRunId,
    briefing: metricsRun.marketContext,
    products: metricsRun.normalizedProducts.slice(0, 5),
    metrics,
    evidenceRefs: metricsRun.evidenceRefs.slice(0, 10),
    workflow,
    dataQuality,
    inventoryContext: {
      requested: metricsRun.marketContext.useInventoryContext,
      available: !metricsRun.warnings.includes(INVENTORY_CONTEXT_UNAVAILABLE_WARNING),
      warningMessage: metricsRun.warnings.find((warning) => warning === INVENTORY_CONTEXT_UNAVAILABLE_WARNING),
      sourceLabel: undefined
    }
  };
  const assistantStartedAt = new Date().toISOString();

  for (const assistantType of workflow.filter((step) => !step.optional).map((step) => step.agentType)) {
    amiLog("ASSISTANT", "ASSISTANT_START", {
      runId: metricsRun.analysisRunId,
      assistantType,
      sourceMode: metricsRun.sourceMode
    });
  }

  amiLog("ORCHESTRATOR", "ORCHESTRATOR_START", {
    runId: metricsRun.analysisRunId,
    coordinatorType: "ami_orchestrator"
  });

  amiDiagLog("ai_completion_started", {
    analysisRunId: metricsRun.analysisRunId,
    sourceMode: metricsRun.sourceMode,
    demoMode: metricsRun.demoMode
  });

  let agentResult: Awaited<ReturnType<typeof runAmiAgents>>;
  try {
    agentResult = await runAmiAgents(agentContext);
  } catch (agentErr) {
    amiDiagLog("ai_completion_failed", {
      analysisRunId: metricsRun.analysisRunId,
      error: agentErr instanceof Error ? agentErr.message : "Unknown error in runAmiAgents"
    });
    throw agentErr;
  }
  const completedAt = new Date().toISOString();
  amiDiagLog("ai_completion_completed", {
    analysisRunId: metricsRun.analysisRunId,
    usedFallback: agentResult.usedFallback,
    warningCount: agentResult.warnings.length
  });
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
    metricsRun.evidenceRefs,
    sourceMode,
    outputs,
    metrics.canonicalMetrics,
    metricsRun.dataQualitySummary
  );
  const agentStatus = buildAgentStatus(outputs, workflow);
  const sourceFallbackUsed = metricsRun.fallbackUsed;
  const usedFallback = sourceFallbackUsed || agentResult.usedFallback;
  const warnings = [...metricsRun.warnings, ...agentResult.warnings].filter(Boolean);
  const assistantRunTrace = buildAssistantRunTrace(
    metricsRun.analysisRunId,
    outputs,
    metricsRun.sourceSummary,
    metricsRun.marketContext,
    workflow,
    dataQuality,
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

  amiLog("ORCHESTRATOR", "ORCHESTRATOR_COMPLETE", {
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

  const finalStatus: AnalysisResult["status"] = usedFallback ? "completed_with_fallback" : "completed";
  const analysisRun = metricsRun.analysisRun
    ? {
        ...metricsRun.analysisRun,
        status: finalStatus,
        completedAt,
        updatedAt: completedAt
      }
    : undefined;
  const secondary = secondaryRecommendation(executiveRecommendation, metricsRun.marketContext);
  const result = AnalysisResultSchema.parse({
    ...metricsRun,
    analysisRun,
    status: finalStatus,
    completedAt,
    sourceMode,
    fallbackUsed: sourceFallbackUsed,
    sourceCollectionStatus: {
      ...metricsRun.sourceCollectionStatus,
      mode: sourceMode,
      usedFallback: sourceFallbackUsed,
      fallbackUsed: sourceFallbackUsed,
      demoSnapshotUsed: metricsRun.sourceCollectionStatus.demoSnapshotUsed || sourceMode === "demo" || sourceMode === "demo_seed",
      liveProviderUsed: metricsRun.sourceCollectionStatus.liveProviderUsed || sourceMode === "live" || sourceMode === "mixed",
      sourceLabel: sourceModeLabel(sourceMode)
    },
    assistantStatus: assistantStatusRecord(agentStatus),
    agentStatus,
    assistantRuns: assistantRunTrace,
    agentRuns: outputs,
    synthesis: agentResult.synthesis,
    finalVerdict,
    assistantRunTrace,
    coordinatorTrace,
    externalActionPayload: finalVerdict.externalActionPayload,
    executiveRecommendation,
    recommendations: [executiveRecommendation, secondary],
    opportunities: [executiveRecommendation, secondary],
    assistantFindings: outputs.map((output) => findingFromOutput(output, sourceMode)),
    warnings,
    usedFallback,
    fallbackReason: sourceFallbackUsed ? metricsRun.fallbackReason : agentResult.usedFallback ? agentResult.warnings[0] : undefined,
    demoMode: sourceMode === "demo" || sourceMode === "demo_seed"
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
