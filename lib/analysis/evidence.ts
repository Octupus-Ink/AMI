import type { EvidencePackage, MarketContextPayload, NormalizedProduct, SourceMode } from "@/lib/schemas/ami";
import { EvidencePackageSchema } from "@/lib/schemas/ami";
import type { EvidenceRef } from "@/lib/schemas/agents";
import { sanitizeEvidenceSnippet, toHttpSourceUrl } from "@/lib/analysis/source-state";

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

export function buildEvidencePackages(
  context: MarketContextPayload,
  products: NormalizedProduct[],
  evidenceRefs: EvidenceRef[],
  mode: SourceMode,
  brightDataProduct: EvidencePackage["brightDataProduct"],
  scrapedAt: string
): EvidencePackage[] {
  const primary = products[0];
  const primaryRef = evidenceRefs.find((ref) => primary?.evidenceRefs.includes(ref.id)) ?? evidenceRefs[0];
  const sourceUrl = toHttpSourceUrl(primaryRef?.url);
  const isFallback = mode === "demo_fallback" || mode === "demo_snapshot" || mode === "mixed";
  const sourceType =
    mode === "live"
      ? "bright_data_live_web_data"
      : mode === "error" || mode === "not_configured"
        ? "provider_unavailable"
        : "bright_data_demo_fallback_snapshot";
  const demandIndicators = evidenceRefs
    .slice(0, 3)
    .map((ref) => sanitizeEvidenceSnippet(ref.snippet ?? ref.label, 180))
    .filter((item): item is string => Boolean(item));

  return [
    EvidencePackageSchema.parse({
      evidencePackageId: primaryRef?.id ?? `evidence_${scrapedAt}`,
      sourceMarketplace: context.targetMarketplace,
      sourceType,
      ...(sourceUrl ? { sourceUrl } : {}),
      brightDataProduct,
      brightDataMode: mode,
      sourceMode: mode,
      isFallback,
      scrapedAt,
      productIdentity: primary?.title ?? context.productName,
      currentPrice: primary?.priceUsd ?? primary?.price ?? 0,
      supplierPrice: primary?.supplierPrice ?? 0,
      estimatedMargin: primary?.estimatedMargin ?? 0,
      demandIndicators: demandIndicators.length ? demandIndicators : ["No visible source evidence available"],
      socialMomentum: signalLabel(primary?.trendMomentum),
      competitionLevel: competitionLevel(primary?.pricePressure),
      matchQuality: confidenceLabel(primary?.matchConfidence),
      matchScore: Math.round((primary?.matchConfidence ?? 0.65) * 100),
      matchedAttributes: ["Product name", "Category", "Marketplace query intent"].filter(Boolean),
      riskInputs: [
        `Price pressure ${primary?.pricePressure ?? 0}/100`,
        `Inventory risk ${primary?.inventoryRisk ?? 0}/100`,
        primary?.deliveryCostNote ?? "Supplier delivery cost requires validation"
      ],
      assistantUsed: "competitor"
    })
  ];
}
