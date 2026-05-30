import type { EvidencePackage, MarketContextPayload, NormalizedProduct, NormalizedSourceMode, SourceMode, SourceProvider } from "@/lib/schemas/ami";
import { EvidencePackageSchema } from "@/lib/schemas/ami";
import type { EvidenceRef } from "@/lib/schemas/agents";
import { sanitizeEvidenceSnippet, toHttpSourceUrl } from "@/lib/analysis/source-state";
import { extractedProductFields, isSourceFallbackMode } from "@/lib/analysis/source-trace";

type EvidenceTraceOptions = {
  runId?: string;
  sourceProvider?: SourceProvider;
  sourceProduct?: string;
  sourceName?: string;
  targetMarketplace?: string;
  scraperName?: string;
  datasetId?: string;
  operation?: string;
  snapshotId?: string;
  rawRef?: string;
  mode?: NormalizedSourceMode;
  assistantTypesUsedBy?: Array<"trend" | "competitor" | "supplier" | "inventory">;
};

function confidenceLabel(value: number | undefined): "low" | "medium" | "high" {
  if ((value ?? 0) >= 0.78) {
    return "high";
  }

  if ((value ?? 0) >= 0.55) {
    return "medium";
  }

  return "low";
}

function signalLabel(value: number | undefined): "weak" | "moderate" | "strong" {
  if ((value ?? 0) >= 70) {
    return "strong";
  }

  if ((value ?? 0) >= 45) {
    return "moderate";
  }

  return "weak";
}

function competitionLevel(value: number | undefined): "low" | "moderate" | "high" {
  if ((value ?? 0) >= 70) {
    return "high";
  }

  if ((value ?? 0) >= 45) {
    return "moderate";
  }

  return "low";
}

function normalizedEvidenceMode(mode: SourceMode, override?: NormalizedSourceMode): NormalizedSourceMode {
  if (override) {
    return override;
  }

  return mode === "live" ? "live" : isSourceFallbackMode(mode) ? "fallback_snapshot" : "demo_seed";
}

export function buildEvidencePackages(
  context: MarketContextPayload,
  products: NormalizedProduct[],
  evidenceRefs: EvidenceRef[],
  mode: SourceMode,
  brightDataProduct: EvidencePackage["brightDataProduct"],
  scrapedAt: string,
  trace: EvidenceTraceOptions = {}
): EvidencePackage[] {
  const primary = products[0];
  const primaryRef = evidenceRefs.find((ref) => primary?.evidenceRefs.includes(ref.id)) ?? evidenceRefs[0];
  const sourceUrl = toHttpSourceUrl(primaryRef?.url);
  const normalizedMode = normalizedEvidenceMode(mode, trace.mode);
  const isFallback = normalizedMode !== "live";
  const sourceType =
    normalizedMode === "live"
      ? "bright_data_live_web_data"
      : normalizedMode === "fallback_snapshot"
        ? "bright_data_preserved_raw_snapshot"
        : "demo_seed";
  const demandIndicators = evidenceRefs
    .slice(0, 3)
    .map((ref) => sanitizeEvidenceSnippet(ref.snippet ?? ref.label, 180))
    .filter((item): item is string => Boolean(item));

  return [
    EvidencePackageSchema.parse({
      evidencePackageId: primaryRef?.id ?? `evidence_${scrapedAt}`,
      ...(trace.runId ? { runId: trace.runId } : {}),
      sourceMarketplace: context.targetMarketplace,
      sourceType,
      ...(sourceUrl ? { sourceUrl } : {}),
      sourceProvider: trace.sourceProvider ?? (normalizedMode === "demo_seed" ? "demo" : "brightdata"),
      sourceProduct: trace.sourceProduct ?? brightDataProduct,
      sourceName: trace.sourceName ?? trace.sourceProduct ?? brightDataProduct,
      targetMarketplace: trace.targetMarketplace ?? context.targetMarketplace,
      scraperName: trace.scraperName,
      datasetId: trace.datasetId,
      operation: trace.operation,
      snapshotId: trace.snapshotId,
      ...(sourceUrl ? { productUrl: sourceUrl } : {}),
      ...(primary?.imageUrl ? { imageUrl: primary.imageUrl } : {}),
      title: primary?.title ?? context.productName,
      price: primary?.priceUsd ?? primary?.price,
      currency: primary?.currency ?? context.currency,
      rating: primary?.rating,
      reviewsCount: primary?.reviewsCount,
      availability: primary?.availability,
      sellerName: primary?.supplierName,
      category: primary?.category,
      ...(trace.rawRef ? { rawRef: trace.rawRef } : {}),
      capturedAt: scrapedAt,
      mode: normalizedMode,
      extractedFields: extractedProductFields(primary as Record<string, unknown> | undefined),
      assistantTypesUsedBy: trace.assistantTypesUsedBy ?? ["trend", "competitor", "supplier", "inventory"],
      brightDataProduct,
      brightDataMode: normalizedMode,
      sourceMode: normalizedMode,
      isFallback,
      scrapedAt,
      productIdentity: primary?.title ?? context.productName,
      currentPrice: primary?.priceUsd ?? primary?.price ?? null,
      supplierPrice: primary?.supplierPrice ?? null,
      estimatedMargin: primary?.estimatedMargin ?? null,
      demandIndicators: demandIndicators.length ? demandIndicators : ["No visible source evidence available"],
      socialMomentum: signalLabel(primary?.trendMomentum),
      competitionLevel: competitionLevel(primary?.pricePressure),
      matchQuality: confidenceLabel(primary?.matchConfidence),
      matchScore: Math.round((primary?.matchConfidence ?? 0.65) * 100),
      matchedAttributes: ["Product name", "Category", "Marketplace query intent"].filter(Boolean),
      riskInputs: [
        primary?.pricePressure === undefined ? "Price pressure unknown because price data is incomplete" : `Price pressure ${primary.pricePressure}/100`,
        primary?.inventoryRisk === undefined ? "Inventory risk unknown" : `Inventory risk ${primary.inventoryRisk}/100`,
        primary?.deliveryCostNote ?? "Supplier delivery cost requires validation"
      ],
      assistantUsed: "competitor"
    })
  ];
}
