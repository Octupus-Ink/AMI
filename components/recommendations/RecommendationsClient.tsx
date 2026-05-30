"use client";

import { useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileSearch,
  ShieldAlert,
  X
} from "lucide-react";
import { PageShell, Section, Surface } from "@/components/layout/PagePrimitives";
import { BrightDataPill } from "@/components/ui/BrightDataPill";
import { Badge } from "@/components/ui/Badge";
import { resolveSourceState, sanitizeEvidenceSnippet, toHttpSourceUrl } from "@/lib/analysis/source-state";
import {
  deriveSupplierSourceState,
  SUPPLIER_SOURCE_EMPTY_COPY,
  type SupplierSourceStatus
} from "@/lib/analysis/supplier-source-state";
import { amiDiagLog, createDiagRequestId } from "@/lib/diagnostics/ami-diag";
import type { AnalysisResult, EvidenceLink, EvidencePackage, SourceMode, SupplierOption } from "@/lib/schemas/ami";
import { BusinessGoals, VisibleAssistants } from "@/lib/schemas/ami";

const strategyTabs = [
  "Product Candidates",
  "Promo Candidates",
  "Inventory Actions",
  "Supplier Comparison",
  "Evidence & Reasoning"
] as const;

type StrategyTab = (typeof strategyTabs)[number];

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

  return String(mode)
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function sourceStateForAnalysis(analysis: AnalysisResult) {
  return resolveSourceState({
    mode: analysis.sourceMode ?? analysis.sourceCollectionStatus.mode,
    providerStatus: analysis.sourceCollectionStatus.providerStatus,
    usedFallback: analysis.fallbackUsed ?? analysis.sourceCollectionStatus.usedFallback,
    fallbackUsed: analysis.fallbackUsed ?? analysis.sourceCollectionStatus.fallbackUsed,
    demoSnapshotUsed: analysis.sourceCollectionStatus.demoSnapshotUsed,
    liveProviderUsed: analysis.sourceCollectionStatus.liveProviderUsed,
    products: analysis.normalizedProducts,
    evidenceRefs: analysis.evidenceRefs,
    sourceProof: analysis.sourceCollectionStatus.sourceProof
  });
}

function safeDisplay(value: string, maxLength = 520) {
  return sanitizeEvidenceSnippet(value, maxLength) ?? "Unavailable";
}

function goalLabel(goalId: string) {
  return BusinessGoals.find((goal) => goal.id === goalId)?.label ?? goalId;
}

function assistantTone(status: string | undefined): "neutral" | "green" | "amber" | "red" | "blue" {
  if (status === "completed") {
    return "green";
  }

  if (status === "warning" || status === "skipped" || status === "fallback") {
    return "amber";
  }

  if (status === "failed") {
    return "red";
  }

  if (status === "running") {
    return "blue";
  }

  return "neutral";
}

const promoKeywords = ["promo", "promotion", "monitor", "campaign", "bundle", "seasonal", "validation", "rollout"];

type RowDisplayVariant = "product" | "promo" | "inventory";
type DisplayRisk = "low" | "medium" | "high" | "critical" | "unknown";

type PreviewRowData = {
  id: string;
  title: string;
  summary: string;
  risk: DisplayRisk;
  confidence?: "low" | "medium" | "high";
  meta?: string;
  variant: RowDisplayVariant;
};

type DrawerDetail = {
  rowId: string;
  variant: RowDisplayVariant;
  title: string;
  summary: string;
  category?: string;
  marketplace?: string;
  targetProduct?: string;
  sourceMode: string;
  opportunityScore?: number;
  confidence?: string;
  risk?: string;
  demand?: string;
  estimatedMargin?: number;
  recommendedAction?: string;
  suggestedNextStep?: string;
  whyItMatters?: string;
  expectedImpact?: string;
  suppliers: SupplierOption[];
  supplierSourceStatus: SupplierSourceStatus;
  evidence?: EvidencePackage;
  evidenceLinks: EvidenceLink[];
  sourceUrlUnavailableReason: string;
};

type SupplierDrawerDetail = {
  supplierId: string;
  supplier: SupplierOption;
  sourceMode: string;
  marketplace?: string;
  supplierPrice?: number | null;
  brightDataProduct?: string;
  brightDataMode?: string;
  riskInputs?: string[];
  evidenceLinks: EvidenceLink[];
  sourceUrlUnavailableReason: string;
  rawRef?: string;
};

type SupplierCandidateProductRow = {
  productName: string;
  unitCost: string;
  delivery: string;
  matchQuality: string;
};

const inventoryTitleMaxLength = 72;

const supplierDeliveryCostFallback =
  "Not included.\nDelivery is usually quoted by batch, volume, destination, and supplier terms.\nContact the provider to confirm shipping terms.";

type PromoMetaInput = {
  assistantId?: string;
  dataFreshness?: string;
  sourceLabel?: string;
  recommendedAction?: string;
};

function riskBadgeTone(risk: DisplayRisk) {
  return risk === "critical" || risk === "high" ? "red" : risk === "medium" || risk === "unknown" ? "amber" : "green";
}

function formatMargin(estimatedMargin: number | undefined) {
  if (estimatedMargin === undefined || estimatedMargin <= 0) {
    return undefined;
  }

  return `Est. margin ${estimatedMargin.toFixed(1)}%`;
}

function isFiniteMoneyValue(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function formatSupplierCost(value: number | null | undefined, currency?: string | undefined) {
  if (!isFiniteMoneyValue(value)) {
    return "Unknown";
  }

  return currency ? `${currency} ${value.toFixed(2)}` : `$${value.toFixed(2)}`;
}

function formatNullableMoney(value: number | null | undefined) {
  return formatSupplierCost(value);
}

function escapeHtml(value: string | undefined) {
  const text = value ?? "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatString(value: unknown, fallback = "Not available") {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  return String(value);
}

// Return the first non-empty/meaningful value from a list of candidates.
function getFirstPresentValue(...values: unknown[]) {
  return values.find((value) => {
    if (value === null || value === undefined) return false;
    if (typeof value === "number") return Number.isFinite(value);
    if (typeof value === "string") return value.trim().length > 0;
    return true;
  });
}

function formatMoneyLike(value: unknown, currency?: string | undefined) {
  if (value === null || value === undefined) return undefined;

  // Accept numeric strings too
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.-]/g, ""));
    if (!Number.isFinite(parsed)) return undefined;
    return `${currency ?? "USD"} ${parsed.toFixed(2)}`;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return undefined;
    return `${currency ?? "USD"} ${value.toFixed(2)}`;
  }

  return undefined;
}

function buildSupplierRangeFromValues(values: (number | undefined | null)[]) {
  const nums = values.filter((v): v is number => v !== undefined && v !== null && Number.isFinite(v));

  if (nums.length === 0) return { min: undefined as number | undefined, max: undefined as number | undefined };

  const min = Math.min(...nums);
  const max = Math.max(...nums);
  return { min, max };
}

function getEvidenceExternalId(evidence: EvidencePackage | undefined) {
  const extracted = evidence?.extractedFields as Record<string, unknown> | undefined;
  const value = extracted?.external_id ?? extracted?.externalId ?? extracted?.asin ?? extracted?.item_id;

  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);

  return undefined;
}

function candidateEvidenceIds(
  opportunity: AnalysisResult["opportunities"][number] | undefined,
  evidence: EvidencePackage | undefined
) {
  return new Set(
    [
      opportunity?.evidencePackageId,
      evidence?.evidencePackageId
    ].filter((value): value is string => Boolean(value))
  );
}

function supplierMatchesCandidate(
  supplier: SupplierOption,
  opportunity: AnalysisResult["opportunities"][number] | undefined,
  evidence: EvidencePackage | undefined
) {
  const evidenceIds = candidateEvidenceIds(opportunity, evidence);

  if (supplier.evidenceRefIds?.some((id) => evidenceIds.has(id))) {
    return true;
  }

  const externalId = getEvidenceExternalId(evidence);

  if (externalId && supplier.externalId && supplier.externalId === externalId) {
    return true;
  }

  // Last-resort linkage only: one raw snapshot can contain several products.
  const snapshot = evidence?.rawSourceSnapshotId ?? evidence?.rawRef;
  return Boolean(snapshot && supplier.rawSourceSnapshotId && supplier.rawSourceSnapshotId === snapshot);
}

function candidateDedupeKey(
  row: PreviewRowData,
  opportunity: AnalysisResult["opportunities"][number] | undefined,
  evidence: EvidencePackage | undefined
) {
  const record = (opportunity ?? {}) as Record<string, unknown>;

  for (const field of ["productCandidateId", "candidateId", "productId", "normalizedProductId", "productMatchId"]) {
    const value = record[field];

    if ((typeof value === "string" && value.trim()) || typeof value === "number") {
      return `${field}:${String(value)}`;
    }
  }

  const externalId = getEvidenceExternalId(evidence);
  if (externalId) return `externalId:${externalId}`;
  if (evidence?.evidencePackageId) return `evidencePackageId:${evidence.evidencePackageId}`;

  const snapshot = evidence?.rawSourceSnapshotId ?? evidence?.rawRef;
  if (snapshot) return `titleSnapshot:${row.title}::${snapshot}`;

  return `rowId:${row.id}`;
}

function getProductCandidateCommercialSnapshot(
  opportunity: AnalysisResult["opportunities"][number] | undefined,
  analysis: AnalysisResult,
  suppliers: SupplierOption[] | undefined
) {
  const evidence = opportunity
    ? analysis.evidencePackages.find((item) => item.evidencePackageId === opportunity.evidencePackageId)
    : analysis.evidencePackages[0];

  const currency = analysis.marketContext.currency ?? "USD";
  const opportunityRecord = opportunity as Record<string, unknown> | undefined;
  const evidenceRecord = evidence as Record<string, unknown> | undefined;

  // Market price: check opportunity, evidence, then fall back to normalizedProducts
  const matchedProduct = evidence
    ? analysis.normalizedProducts.find((p) => p.evidenceRefs?.some((ref) => ref === evidence.evidencePackageId))
        ?? (opportunity ? analysis.normalizedProducts.find((p) => p.evidenceRefs?.some((ref) => opportunity.evidenceRefs?.includes(ref))) : undefined)
    : undefined;

  const marketPriceRaw = getFirstPresentValue(
    opportunityRecord?.price,
    opportunityRecord?.priceUsd,
    opportunityRecord?.finalPrice,
    opportunityRecord?.initialPrice,
    opportunityRecord?.currentPrice,
    opportunityRecord?.currentPriceUsd,
    opportunityRecord?.marketPrice,
    opportunityRecord?.marketPriceUsd,
    opportunityRecord?.estimatedPrice,
    opportunityRecord?.estimatedPriceUsd,
    evidence?.price,
    evidence?.currentPrice,
    // Fall back to normalized product price chain: finalPrice is already resolved into price during normalization
    matchedProduct?.priceUsd,
    matchedProduct?.price
  );

  const marketPrice = formatMoneyLike(marketPriceRaw, currency);

  // Supplier costs: try evidence.supplierPrice, then match suppliers by stable product evidence ids.
  const supplierPricesFromEvidence = [] as (number | undefined)[];

  if (evidence && isFiniteMoneyValue((evidence as EvidencePackage).supplierPrice)) {
    supplierPricesFromEvidence.push((evidence as EvidencePackage).supplierPrice as number | undefined);
  }

  let supplierOfferCount = 0;
  const supplierCandidates: number[] = [];
  let matchedSuppliers: SupplierOption[] = [];

  if (suppliers && evidence) {
    matchedSuppliers = suppliers.filter((supplier) => supplierMatchesCandidate(supplier, opportunity, evidence));

    if (matchedSuppliers.length > 0) {
      supplierOfferCount = matchedSuppliers.length;
      for (const s of matchedSuppliers) {
        if (isFiniteMoneyValue(s.estimatedUnitCost)) {
          supplierCandidates.push(s.estimatedUnitCost);
        }
      }
    }
  }

  const allSupplierNums = [...supplierPricesFromEvidence, ...supplierCandidates];
  const { min: supplierCostMin, max: supplierCostMax } = buildSupplierRangeFromValues(allSupplierNums);

  // Delivery estimate: prefer evidence->delivery note, otherwise supplier estimatedDeliveryTime if uniquely matched
  const deliveryEstimate = getFirstPresentValue(
    evidenceRecord?.estimatedDeliveryTime,
    matchedSuppliers.length === 1 ? matchedSuppliers[0].estimatedDeliveryTime : undefined
  );

  const hasMarketPrice = Boolean(marketPriceRaw !== undefined && marketPriceRaw !== null && marketPrice !== undefined);
  const hasSupplierCost = Boolean(supplierCostMin !== undefined || supplierCostMax !== undefined);
  const hasAnyCommercialData = hasMarketPrice || hasSupplierCost || supplierOfferCount > 0 || Boolean(deliveryEstimate);

  return {
    marketPriceRaw,
    marketPrice,
    supplierCostMin,
    supplierCostMax,
    supplierOfferCount,
    deliveryEstimate: typeof deliveryEstimate === "string" ? deliveryEstimate : deliveryEstimate ? String(deliveryEstimate) : undefined,
    hasMarketPrice,
    hasSupplierCost,
    hasAnyCommercialData
  };
}

function getCommercialSnapshotFromEvidence(evidence: EvidencePackage | undefined, suppliers: SupplierOption[] | undefined, currency?: string) {
  const currencyUsed = currency ?? "USD";

  if (!evidence) {
    return {
      marketPriceRaw: undefined,
      marketPrice: undefined,
      supplierCostMin: undefined,
      supplierCostMax: undefined,
      supplierOfferCount: 0,
      deliveryEstimate: undefined,
      hasMarketPrice: false,
      hasSupplierCost: false,
      hasAnyCommercialData: false
    };
  }

  const evidenceRecord = evidence as Record<string, unknown>;
  const marketPriceRaw = getFirstPresentValue(
    (evidence as EvidencePackage).price,
    (evidence as EvidencePackage).currentPrice,
    evidenceRecord.finalPrice,
    evidenceRecord.priceUsd,
    evidenceRecord.initialPrice
  );
  const marketPrice = formatMoneyLike(marketPriceRaw, currencyUsed);

  const supplierPricesFromEvidence = [] as (number | undefined)[];
  if (isFiniteMoneyValue((evidence as EvidencePackage).supplierPrice)) {
    supplierPricesFromEvidence.push((evidence as EvidencePackage).supplierPrice as number | undefined);
  }

  let supplierOfferCount = 0;
  const supplierCandidates: number[] = [];

  if (suppliers && evidence) {
    const matches = suppliers.filter((supplier) => supplierMatchesCandidate(supplier, undefined, evidence));
    supplierOfferCount = matches.length;
    for (const s of matches) {
      if (isFiniteMoneyValue(s.estimatedUnitCost)) {
        supplierCandidates.push(s.estimatedUnitCost);
      }
    }
  }

  const allSupplierNums = [...supplierPricesFromEvidence, ...supplierCandidates];
  const { min: supplierCostMin, max: supplierCostMax } = buildSupplierRangeFromValues(allSupplierNums);

  const deliveryEstimate = getFirstPresentValue((evidence as Record<string, unknown>).estimatedDeliveryTime);

  const hasMarketPrice = Boolean(marketPriceRaw !== undefined && marketPriceRaw !== null && marketPrice !== undefined);
  const hasSupplierCost = Boolean(supplierCostMin !== undefined || supplierCostMax !== undefined);
  const hasAnyCommercialData = hasMarketPrice || hasSupplierCost || supplierOfferCount > 0 || Boolean(deliveryEstimate);

  return {
    marketPriceRaw,
    marketPrice,
    supplierCostMin,
    supplierCostMax,
    supplierOfferCount,
    deliveryEstimate: typeof deliveryEstimate === "string" ? deliveryEstimate : deliveryEstimate ? String(deliveryEstimate) : undefined,
    hasMarketPrice,
    hasSupplierCost,
    hasAnyCommercialData
  };
}

function formatCurrency(value: unknown, currency?: string | undefined) {
  return isFiniteMoneyValue(value) ? formatSupplierCost(value, currency ?? "USD") : "Unknown";
}

function formatConfidence(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return "Not available";
  }

  if (typeof value === "number") {
    return `${Math.round(value * 100)}%`;
  }

  const text = String(value);
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

function formatRisk(value: string | undefined) {
  if (!value) {
    return "Not available";
  }

  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function buildCountLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function buildPrintableReportHtml(args: {
  analysis: AnalysisResult;
  selectedProductOpportunities: AnalysisResult["opportunities"];
  selectedPromoItems: Array<{
    label: string;
    recommendedAction?: string;
    expectedImpact?: string;
    risk?: string;
    confidence?: string;
    reason?: string;
  }>;
  selectedInventoryItems: Array<{
    label: string;
    currentInventorySignal?: string;
    recommendedAction?: string;
    businessReason?: string;
    risk?: string;
    confidence?: string;
  }>;
  selectedSupplierOptions: SupplierOption[];
  qualityNotice: { title: string; body: string } | null;
  evidenceLinks: EvidenceLink[];
}) {
  const {
    analysis,
    selectedProductOpportunities,
    selectedPromoItems,
    selectedInventoryItems,
    selectedSupplierOptions,
    qualityNotice,
    evidenceLinks
  } = args;

  const businessGoal = goalLabel(analysis.marketContext.businessGoal);
  const marketplace = formatString(analysis.marketContext.targetMarketplace, "Unknown");
  const region = formatString(analysis.marketContext.region, "Unknown");
  const currency = formatString(analysis.marketContext.currency, "Unknown");
  const selectedRecommendationCount =
    selectedProductOpportunities.length + selectedPromoItems.length + selectedInventoryItems.length + selectedSupplierOptions.length;
  const generatedDate = new Date().toLocaleString();
  const inventoryContext = analysis.marketContext.useInventoryContext ? "Included" : "Not connected for this analysis";
  const partnerChoiceSummary = [
    buildCountLabel(selectedProductOpportunities.length, "product opportunity", "product opportunities"),
    buildCountLabel(selectedPromoItems.length, "promo opportunity", "promo opportunities"),
    buildCountLabel(selectedInventoryItems.length, "inventory action", "inventory actions"),
    buildCountLabel(selectedSupplierOptions.length, "supplier note", "supplier notes")
  ];

  const reportSections: string[] = [];

  const addSection = (title: string, content: string) => {
    reportSections.push(`
      <section class="report-section">
        <h2>${escapeHtml(title)}</h2>
        ${content}
      </section>
    `);
  };

  addSection(
    "1. Executive Summary",
    `
      <div class="summary-grid">
        <div><strong>Business goal:</strong> ${escapeHtml(businessGoal)}</div>
        <div><strong>Marketplace:</strong> ${escapeHtml(marketplace)}</div>
        <div><strong>Region:</strong> ${escapeHtml(region)}</div>
        <div><strong>Currency:</strong> ${escapeHtml(currency)}</div>
        <div><strong>Selected recommendations:</strong> ${selectedRecommendationCount}</div>
        <div><strong>Generated:</strong> ${escapeHtml(generatedDate)}</div>
      </div>
    `
  );

  const contextRows = [
    `<div><strong>Business goal:</strong> ${escapeHtml(businessGoal)}</div>`,
    `<div><strong>Marketplace:</strong> ${escapeHtml(marketplace)}</div>`,
    `<div><strong>Region:</strong> ${escapeHtml(region)}</div>`,
    `<div><strong>Currency:</strong> ${escapeHtml(currency)}</div>`,
    `<div><strong>Category:</strong> ${escapeHtml(analysis.marketContext.category)}</div>`,
    `<div><strong>Target product:</strong> ${escapeHtml(analysis.marketContext.productName)}</div>`,
    `<div><strong>Supplier source:</strong> ${escapeHtml(analysis.marketContext.supplierSource)}</div>`,
    `<div><strong>Inventory context:</strong> ${escapeHtml(inventoryContext)}</div>`
  ];

  addSection("2. Analysis Context", `
      <div class="report-list">
        ${contextRows.join("")}
      </div>
    `
  );

  addSection(
    "3. Partner’s Choice",
    `
      <p>Partner’s Choice includes:</p>
      <ul class="report-list">
        ${partnerChoiceSummary.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
    `
  );

  if (selectedProductOpportunities.length > 0) {
    // Determine if any of the selected product opportunities have commercial data
    const anyCommercialPrinted = selectedProductOpportunities.some((opportunity) => {
      const snapshot = getProductCandidateCommercialSnapshot(opportunity, analysis, analysis.supplierOptions);
      return snapshot.hasAnyCommercialData;
    });

    addSection(
      "4. Selected Product Opportunities",
      `
        ${selectedProductOpportunities
          .map((opportunity) => {
            const evidence = analysis.evidencePackages.find((item) => item.evidencePackageId === opportunity.evidencePackageId);
            const demandSignal = opportunity.demandSignal ? opportunity.demandSignal.charAt(0).toUpperCase() + opportunity.demandSignal.slice(1) : undefined;
            const confidence = formatConfidence(opportunity.confidence ?? opportunity.confidenceLevel);
            const risk = formatRisk(opportunity.risk ?? opportunity.riskLevel);

            const snapshot = getProductCandidateCommercialSnapshot(opportunity, analysis, analysis.supplierOptions);
            const currency = analysis.marketContext.currency ?? "USD";

            let commercialHtml = "";

            if (!snapshot.hasAnyCommercialData) {
              commercialHtml = `<div class="report-field"><strong>Pricing data was not available from the current source records.</strong></div>`;
            } else {
              const marketPrice = snapshot.hasMarketPrice ? escapeHtml(snapshot.marketPrice ?? "Not available") : "Not available";

              let supplierCostText: string | undefined;
              if (snapshot.supplierCostMin !== undefined && snapshot.supplierCostMax !== undefined) {
                if (snapshot.supplierCostMin === snapshot.supplierCostMax) {
                  supplierCostText = formatMoneyLike(snapshot.supplierCostMin, currency) ?? "Not available";
                } else {
                  supplierCostText = `${formatMoneyLike(snapshot.supplierCostMin, currency)}–${formatMoneyLike(snapshot.supplierCostMax, currency)}`;
                }
              } else if (snapshot.supplierCostMin !== undefined) {
                supplierCostText = formatMoneyLike(snapshot.supplierCostMin, currency) ?? "Not available";
              } else if (snapshot.supplierCostMax !== undefined) {
                supplierCostText = formatMoneyLike(snapshot.supplierCostMax, currency) ?? "Not available";
              }

              const supplierOffers = snapshot.supplierOfferCount > 0 ? `${snapshot.supplierOfferCount} available` : undefined;
              const delivery = snapshot.deliveryEstimate ? escapeHtml(snapshot.deliveryEstimate) : undefined;

              commercialHtml = `
                <div class="report-field"><strong>Market price:</strong> ${escapeHtml(marketPrice ?? "Not available")}</div>
                <div class="report-field"><strong>Supplier cost:</strong> ${escapeHtml(supplierCostText ?? "Not available")}</div>
                ${!snapshot.hasSupplierCost ? `<div class="report-field"><em>Margin cannot be estimated until supplier cost is validated.</em></div>` : ""}
                ${supplierOffers ? `<div class="report-field"><strong>Supplier offers:</strong> ${escapeHtml(supplierOffers)}</div>` : ""}
                ${delivery ? `<div class="report-field"><strong>Delivery estimate:</strong> ${escapeHtml(delivery)}</div>` : ""}
              `;
            }

            return `
              <div class="report-card">
                <h3>${escapeHtml(analysis.marketContext.productName ?? opportunity.recommendedAction ?? "Product opportunity")}</h3>
                <div class="report-field"><strong>Category:</strong> ${escapeHtml(analysis.marketContext.category)}</div>
                <div class="report-field"><strong>Marketplace:</strong> ${escapeHtml(analysis.marketContext.targetMarketplace)}</div>
                ${commercialHtml}
                <div class="report-field"><strong>Demand signal:</strong> ${escapeHtml(demandSignal ?? "Not available")}</div>
                <div class="report-field"><strong>Risk:</strong> ${escapeHtml(risk)}</div>
                <div class="report-field"><strong>Confidence:</strong> ${escapeHtml(confidence)}</div>
                <div class="report-field"><strong>Recommended action:</strong> ${escapeHtml(opportunity.recommendedAction)}</div>
                <div class="report-field"><strong>Why this matters:</strong> ${escapeHtml(opportunity.primaryReason)}</div>
              </div>
            `;
          })
          .join("")}
        ${anyCommercialPrinted ? `<div class="report-field"><em>Supplier cost does not include freight, import fees, taxes, or marketplace fees.</em></div>` : ""}
      `
    );
  }

  if (selectedPromoItems.length > 0) {
    addSection(
      "5. Selected Promo Opportunities",
      `
        ${selectedPromoItems
          .map((item) => `
            <div class="report-card">
              <h3>${escapeHtml(item.label)}</h3>
              ${item.recommendedAction ? `<div class="report-field"><strong>Recommended promo action:</strong> ${escapeHtml(item.recommendedAction)}</div>` : ""}
              ${item.expectedImpact ? `<div class="report-field"><strong>Expected impact:</strong> ${escapeHtml(item.expectedImpact)}</div>` : ""}
              <div class="report-field"><strong>Risk:</strong> ${escapeHtml(formatRisk(item.risk))}</div>
              <div class="report-field"><strong>Confidence:</strong> ${escapeHtml(formatConfidence(item.confidence))}</div>
              ${item.reason ? `<div class="report-field"><strong>Reason:</strong> ${escapeHtml(item.reason)}</div>` : ""}
            </div>
          `)
          .join("")}
      `
    );
  }

  if (selectedInventoryItems.length > 0) {
    addSection(
      "6. Selected Inventory Actions",
      `
        ${selectedInventoryItems
          .map((item) => `
            <div class="report-card">
              <h3>${escapeHtml(item.label)}</h3>
              ${item.currentInventorySignal ? `<div class="report-field"><strong>Current inventory signal:</strong> ${escapeHtml(item.currentInventorySignal)}</div>` : ""}
              ${item.recommendedAction ? `<div class="report-field"><strong>Recommended action:</strong> ${escapeHtml(item.recommendedAction)}</div>` : ""}
              ${item.businessReason ? `<div class="report-field"><strong>Business reason:</strong> ${escapeHtml(item.businessReason)}</div>` : ""}
              <div class="report-field"><strong>Risk:</strong> ${escapeHtml(formatRisk(item.risk))}</div>
              <div class="report-field"><strong>Confidence:</strong> ${escapeHtml(formatConfidence(item.confidence))}</div>
            </div>
          `)
          .join("")}
      `
    );
  }

  if (selectedSupplierOptions.length > 0) {
    addSection(
      "7. Selected Supplier Notes",
      `
        ${selectedSupplierOptions
          .map((supplier) => `
            <div class="report-card">
              <h3>${escapeHtml(supplier.supplierName)}</h3>
              <div class="report-field"><strong>Source market:</strong> ${escapeHtml(supplier.source)}</div>
              <div class="report-field"><strong>Estimated cost:</strong> ${escapeHtml(formatCurrency(supplier.estimatedUnitCost, analysis.marketContext.currency))}</div>
              <div class="report-field"><strong>Estimated delivery time:</strong> ${escapeHtml(supplier.estimatedDeliveryTime)}</div>
              <div class="report-field"><strong>Supplier risk:</strong> ${escapeHtml(formatRisk(supplier.risk))}</div>
              <div class="report-field"><strong>Availability signal:</strong> ${escapeHtml(supplier.availability)}</div>
              <div class="report-field"><strong>Notes:</strong> ${escapeHtml(supplier.ratingQualityProxy)}</div>
            </div>
          `)
          .join("")}
      `
    );
  }

  if (qualityNotice) {
    addSection(
      "8. Data Quality Notice",
      `<p>${escapeHtml(qualityNotice.body)}</p>`
    );
  }

  const evidenceItemsSection = evidenceLinks.length
    ? `<ul class="report-list">
        ${evidenceLinks
          .map((link) => `<li><a href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer noopener">${escapeHtml(link.label)}</a></li>`)
          .join("")}
      </ul>`
    : `<p>Evidence is based on marketplace, trend, supplier, and inventory signals captured during this analysis.</p>`;

  addSection("9. Evidence Summary", `
      <p>AMI analyses the following evidence to support these recommendations:</p>
      <ul class="report-list">
        <li>Marketplace price and competitor signals.</li>
        <li>Demand and trend indicators for the target product or category.</li>
        <li>Supplier availability and cost signals.</li>
        <li>Inventory context signals when available.</li>
      </ul>
      ${evidenceItemsSection}
    `
  );

  const nextSteps: string[] = [
    "Review live marketplace prices before purchase.",
    "Compare supplier delivery times before committing.",
    "Prioritize products with stronger demand signals and acceptable risk.",
    "Re-check items with degraded data quality before acting."
  ];

  addSection(
    "10. Recommended Next Steps",
    `
      <ul class="report-list">
        ${nextSteps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}
      </ul>
    `
  );

  addSection(
    "11. Disclaimer",
    `<p>AMI recommendations are decision-support outputs. Review live marketplace, inventory, supplier, and pricing data before making purchase, restock, pricing, or supplier decisions.</p>`
  );

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>AMI Marketplace Report</title>
        <style>
          body { margin: 0; padding: 24px; font-family: Inter, Arial, sans-serif; color: #111827; background: #ffffff; }
          h1, h2, h3 { margin: 0; }
          h1 { font-size: 32px; margin-bottom: 16px; }
          h2 { font-size: 20px; margin-top: 32px; margin-bottom: 12px; }
          h3 { font-size: 16px; margin-top: 20px; margin-bottom: 8px; }
          p { margin: 0 0 12px; line-height: 1.6; }
          .summary-grid { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
          .report-list { margin: 0; padding-left: 18px; }
          .report-list li { margin-bottom: 6px; }
          .report-field { margin-bottom: 8px; }
          .report-card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; background: #f8fafc; margin-bottom: 16px; }
          .report-section { page-break-inside: avoid; }
          a { color: #0f766e; text-decoration: none; }
          a:hover { text-decoration: underline; }
          @media print {
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            .no-print { display: none; }
            a::after { content: " (" attr(href) ")"; font-size: 12px; }
          }
        </style>
      </head>
      <body>
        <h1>AMI Marketplace Report</h1>
        ${reportSections.join("")}
      </body>
    </html>
  `;
}

function getSelectedProductOpportunities(analysis: AnalysisResult, selectedProductIds: Set<string>) {
  const selectedIds = new Set(Array.from(selectedProductIds).map((id) => id.replace(/^product-/, "")));
  return analysis.opportunities.filter((opportunity) => selectedIds.has(opportunity.recommendationId));
}

function getSelectedPromoItems(analysis: AnalysisResult, selectedPromoIds: Set<string>) {
  return Array.from(selectedPromoIds)
    .map((rowId) => {
      const rawId = rowId.replace(/^promo-/, "");
      const opportunity = analysis.opportunities.find((item) => item.recommendationId === rawId);
      if (opportunity) {
        return {
          label: opportunity.recommendedAction ?? "Promo opportunity",
          recommendedAction: opportunity.recommendedAction,
          expectedImpact: `${opportunity.matchQuality} match · ${opportunity.signalStrength} signal`,
          risk: formatRisk(opportunity.risk ?? opportunity.riskLevel),
          confidence: formatConfidence(opportunity.confidence ?? opportunity.confidenceLevel),
          reason: opportunity.primaryReason
        };
      }

      const finding = analysis.assistantFindings.find((item) => `${item.assistantId}-${item.finding}` === rawId);
      if (finding) {
        const productLabel = finding.assistantId === "competitor" ? "Competitor signal" : finding.assistantId === "trend" ? "Trend signal" : "Promo signal";
        return {
          label: productLabel,
          recommendedAction: finding.finding,
          expectedImpact: `${finding.signal} signal`,
          risk: formatRisk(finding.risk),
          confidence: formatConfidence(finding.confidence),
          reason: finding.reason
        };
      }

      return null;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

function getSelectedInventoryItems(
  analysis: AnalysisResult,
  selectedInventoryIds: Set<string>,
  selected: AnalysisResult["executiveRecommendation"]
) {
  return Array.from(selectedInventoryIds)
    .map((rowId) => {
      const rawId = rowId.replace(/^inventory-/, "");

      if (rawId.startsWith("finding-")) {
        const findingKey = rawId.replace(/^finding-/, "");
        const finding = analysis.assistantFindings.find((item) => item.assistantId === "inventory" && item.finding === findingKey);
        if (finding) {
          return {
            label: finding.finding,
            currentInventorySignal: finding.signal,
            recommendedAction: selected.assistantContributions.find((item) => item.assistantId === "inventory")?.latestContribution,
            businessReason: finding.reason,
            risk: formatRisk(finding.risk),
            confidence: formatConfidence(finding.confidence)
          };
        }
      }

      if (rawId.startsWith("contribution-")) {
        const contribution = selected.assistantContributions.find((item) => item.assistantId === "inventory");
        if (contribution) {
          return {
            label: contribution.latestContribution,
            currentInventorySignal: contribution.signalStrength,
            recommendedAction: contribution.latestContribution,
            businessReason: contribution.summary,
            risk: formatRisk(contribution.risk),
            confidence: formatConfidence(contribution.confidence)
          };
        }
      }

      return null;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

function getSelectedSupplierOptions(suppliers: SupplierOption[], selectedSupplierIds: Set<string>) {
  return suppliers.filter((supplier, index) => selectedSupplierIds.has(getSupplierRowId(supplier, index)));
}

function getEvidenceLinksForReport(analysis: AnalysisResult, selected: AnalysisResult["executiveRecommendation"], evidence: EvidencePackage | undefined) {
  return collectEvidenceLinks(selected, evidence, analysis);
}

function dataQualityCopy(analysis: AnalysisResult) {
  const quality = analysis.dataQualitySummary ?? analysis.executiveRecommendation.dataQuality;

  if (!quality || quality.status === "success") {
    return null;
  }

  const sourceIssue = [
    quality.failedSources.length ? `${quality.failedSources.join(", ")} failed during collection.` : "",
    quality.partialSources.length ? `${quality.partialSources.join(", ")} returned partial fields.` : "",
    quality.emptySources.length ? `${quality.emptySources.join(", ")} returned no product records.` : ""
  ].filter(Boolean)[0];
  const fallback = quality.fallbacksUsed.length
    ? `AMI inferred missing signals using ${quality.fallbacksUsed.join(", ")}.`
    : "AMI preserved unknown signals instead of converting missing data to zero.";
  const FIELD_LABELS: Record<string, { label: string; domain: "market" | "supplier" }> = {
    price:                    { label: "price",                    domain: "market" },
    reviewsCount:             { label: "review count",             domain: "market" },
    salesSignal:              { label: "sales signal",             domain: "market" },
    supplierPrice:            { label: "supplier cost",            domain: "supplier" },
    estimatedDeliveryDays:    { label: "supplier delivery estimate", domain: "supplier" },
    supplierAvailability:     { label: "supplier availability",   domain: "supplier" },
    missing_cost_no_margin_roi: { label: "margin cannot be estimated until supplier cost is validated", domain: "supplier" },
  };

  const hasSupplierSource = analysis.sourceMode === "live"
    && (quality.partialSources.some((s) => /supplier|alibaba|aliexpress/i.test(s))
      || quality.failedSources.some((s) => /supplier|alibaba|aliexpress/i.test(s)));

  const supplierNotAttempted = !hasSupplierSource
    && !quality.missingCriticalFields.some((f) => FIELD_LABELS[f]?.domain === "supplier" && f !== "missing_cost_no_margin_roi");

  let validation: string;
  if (supplierNotAttempted) {
    validation = "Market data was collected, but some source records are incomplete. Supplier-native validation was not attempted, so supplier cost, delivery, and availability still require confirmation before acting.";
  } else if (quality.missingCriticalFields.length) {
    const humanize = (f: string) => FIELD_LABELS[f]?.label ?? null;
    const marketFields = quality.missingCriticalFields
      .filter((f) => FIELD_LABELS[f]?.domain === "market")
      .map(humanize).filter((l): l is string => l !== null);
    const supplierFields = quality.missingCriticalFields
      .filter((f) => FIELD_LABELS[f]?.domain === "supplier")
      .map(humanize).filter((l): l is string => l !== null);
    const unknownFields = quality.missingCriticalFields.filter((f) => !FIELD_LABELS[f]);
    if (unknownFields.length) marketFields.push("additional data quality fields");
    const parts: string[] = [];
    if (marketFields.length) parts.push(`Market data gaps: ${marketFields.join(", ")}.`);
    if (supplierFields.length) parts.push(`Supplier data gaps: ${supplierFields.join(", ")}.`);
    validation = (parts.join(" ") || "Review evidence before acting.") + " Confirm these before acting.";
  } else {
    validation = "Review evidence before acting.";
  }

  return {
    title: `Data quality: ${quality.status.charAt(0).toUpperCase()}${quality.status.slice(1)}`,
    body: [
      analysis.sourceMode === "live"
        ? "Live sources collected, but data quality is degraded because source records were incomplete."
        : "",
      sourceIssue,
      fallback,
      validation
    ].filter(Boolean).join(" ")
  };
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

function sourceStatusTone(status: EvidenceLink["sourceStatus"] | undefined) {
  if (status === "success") {
    return "green";
  }

  if (status === "failed") {
    return "red";
  }

  if (status === "partial" || status === "empty") {
    return "amber";
  }

  return "neutral";
}

function linkLabelForSourceType(sourceType: EvidenceLink["sourceType"]) {
  if (sourceType === "supplier") {
    return "View supplier source";
  }

  if (sourceType === "trend") {
    return "Open trend evidence";
  }

  if (sourceType === "search") {
    return "Open marketplace search";
  }

  if (sourceType === "raw_snapshot") {
    return "Open evidence";
  }

  return "Review listing";
}

function collectEvidenceLinks(
  recommendation: AnalysisResult["executiveRecommendation"] | undefined,
  evidence: EvidencePackage | undefined,
  analysis: AnalysisResult
): EvidenceLink[] {
  const links: EvidenceLink[] = [];
  const seen = new Set<string>();
  const rawSourceSnapshotId = evidence?.rawSourceSnapshotId ?? evidence?.rawRef;

  function add(input: {
    label?: string;
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
      label: input.label ?? linkLabelForSourceType(input.sourceType),
      url,
      sourceName: input.sourceName ?? evidence?.sourceName ?? evidence?.sourceMarketplace ?? "Source evidence",
      sourceType: input.sourceType,
      sourceStatus: input.sourceStatus,
      lastSeenAt: input.lastSeenAt ?? evidence?.lastSeenAt ?? evidence?.scrapedAt,
      rawSourceSnapshotId: input.rawSourceSnapshotId ?? rawSourceSnapshotId
    });
  }

  for (const link of [...(recommendation?.evidenceLinks ?? []), ...(recommendation?.sourceUrls ?? [])]) {
    add(link);
  }

  if (evidence) {
    const sourceType = evidenceLinkSourceType(evidence.sourceName ?? evidence.sourceType, "marketplace");

    add({
      url: evidence.productUrl ?? evidence.marketplaceUrl ?? evidence.sourceUrl ?? evidence.url,
      sourceName: evidence.sourceName ?? evidence.sourceMarketplace,
      sourceType,
      sourceStatus: evidence.sourceStatus,
      lastSeenAt: evidence.lastSeenAt ?? evidence.scrapedAt,
      rawSourceSnapshotId
    });
    add({
      url: evidence.supplierUrl,
      sourceName: evidence.sellerName ?? evidence.sourceName ?? analysis.marketContext.supplierSource,
      sourceType: "supplier",
      sourceStatus: evidence.sourceStatus,
      lastSeenAt: evidence.lastSeenAt ?? evidence.scrapedAt,
      rawSourceSnapshotId
    });
  }

  const recommendationEvidenceIds = new Set(recommendation?.evidenceRefs ?? []);
  for (const ref of analysis.evidenceRefs) {
    if (recommendationEvidenceIds.size > 0 && !recommendationEvidenceIds.has(ref.id)) {
      continue;
    }

    add({
      label: "Open evidence",
      url: ref.url,
      sourceName: ref.sourceType || ref.source,
      sourceType: evidenceLinkSourceType(ref.sourceType, "search"),
      lastSeenAt: ref.collectedAt,
      rawSourceSnapshotId
    });
  }

  for (const proof of analysis.sourceCollectionStatus.sourceProof ?? []) {
    add({
      label: "Open evidence",
      url: proof.sourceUrl,
      sourceName: proof.sourceType,
      sourceType: evidenceLinkSourceType(proof.sourceType, proof.isFallback ? "raw_snapshot" : "search"),
      lastSeenAt: proof.collectedAt,
      rawSourceSnapshotId
    });
  }

  return links;
}

function sourceUrlUnavailableReason(
  analysis: AnalysisResult,
  evidence: EvidencePackage | undefined,
  recommendation?: AnalysisResult["executiveRecommendation"]
) {
  const quality = analysis.dataQualitySummary ?? recommendation?.dataQuality ?? analysis.executiveRecommendation.dataQuality;
  const mode = evidence?.brightDataMode ?? analysis.sourceMode;

  if (evidence?.isFallback || analysis.fallbackUsed || mode === "fallback" || mode === "fallback_snapshot") {
    return "Source URL unavailable. AMI used fallback or preserved snapshot evidence, so a public listing URL was not available for this item.";
  }

  if (mode === "demo" || mode === "demo_seed" || mode === "demo_fallback" || mode === "demo_snapshot") {
    return "Source URL unavailable. This recommendation came from demo seed evidence, not a live marketplace listing.";
  }

  if (quality?.partialSources.length || quality?.missingCriticalFields.length || quality?.status === "partial" || quality?.status === "degraded") {
    return "Source URL unavailable. AMI received partial source data for this evidence item, so the original listing link was not available.";
  }

  if (evidence?.rawRef) {
    return "Source URL unavailable. AMI preserved a raw source snapshot reference, but the provider did not return a public listing URL.";
  }

  return "Source URL unavailable. The normalized evidence package is missing a source URL.";
}

function supplierEvidenceLinks(supplier: SupplierOption, analysis: AnalysisResult, evidence: EvidencePackage | undefined) {
  const baseLinks = collectEvidenceLinks(analysis.executiveRecommendation, evidence, analysis);
  const supplierLinks: EvidenceLink[] = [];
  const seen = new Set<string>();

  function add(url: string | undefined, label: string, sourceType: EvidenceLink["sourceType"]) {
    const safeUrl = toHttpSourceUrl(url);

    if (!safeUrl || seen.has(safeUrl)) {
      return;
    }

    seen.add(safeUrl);
    supplierLinks.push({
      label,
      url: safeUrl,
      sourceName: supplier.supplierName,
      sourceType,
      lastSeenAt: supplier.lastSeenAt ?? evidence?.lastSeenAt ?? evidence?.scrapedAt,
      rawSourceSnapshotId: supplier.rawSourceSnapshotId ?? evidence?.rawSourceSnapshotId ?? evidence?.rawRef
    });
  }

  add(supplier.supplierUrl, "View supplier source", "supplier");
  add(supplier.productUrl, "Review listing", "marketplace");
  add(supplier.sourceUrl, "Open evidence", evidenceLinkSourceType(supplier.source, "search"));

  return supplierLinks.length ? supplierLinks : baseLinks.filter((link) => link.sourceType === "supplier" || link.sourceType === "marketplace");
}

function formatPromoMeta(input: PromoMetaInput) {
  if (input.assistantId === "competitor") {
    return "Signal: competitor pressure";
  }

  if (input.assistantId === "trend") {
    return "Signal: seasonal demand";
  }

  const action = input.recommendedAction?.toLowerCase() ?? "";

  if (action.includes("competitor") || action.includes("promotion")) {
    return "Signal: competitor pressure";
  }

  if (action.includes("seasonal")) {
    return "Timing: seasonal validation";
  }

  if (action.includes("validation") || action.includes("rollout") || action.includes("campaign")) {
    return "Timing: validation window";
  }

  const timingSource = input.dataFreshness || input.sourceLabel;

  if (!timingSource) {
    return undefined;
  }

  const timingLower = timingSource.toLowerCase();

  if (timingLower.includes("season")) {
    return "Timing: seasonal validation";
  }

  if (timingLower.includes("run") || timingLower.includes("collected") || timingLower.includes("snapshot")) {
    return "Timing: validation window";
  }

  if (timingSource.length <= 40) {
    return `Timing: ${timingSource}`;
  }

  return undefined;
}

function inventoryDisplayTitle(finding: string, fallbackTitle?: string) {
  if (finding.length <= inventoryTitleMaxLength) {
    return finding;
  }

  return fallbackTitle ?? finding;
}

function getViewportPagination(width: number) {
  if (width >= 1024) {
    return { pageSize: 24, columns: 2 as const };
  }

  if (width >= 768) {
    return { pageSize: 12, columns: 2 as const };
  }

  return { pageSize: 6, columns: 1 as const };
}

function useViewportPagination() {
  const [config, setConfig] = useState(() =>
    typeof window !== "undefined" ? getViewportPagination(window.innerWidth) : { pageSize: 24, columns: 2 as const }
  );

  useEffect(() => {
    function update() {
      setConfig(getViewportPagination(window.innerWidth));
    }

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return config;
}

function getPageCount(total: number, pageSize: number) {
  if (total === 0) {
    return 0;
  }

  return Math.ceil(total / pageSize);
}

function getPageSlice<T>(items: T[], page: number, pageSize: number) {
  const start = page * pageSize;
  return items.slice(start, start + pageSize);
}

function formatRange(start: number, end: number, total: number, label: string) {
  return `${start}–${end} of ${total} ${label}`;
}

function toggleSelection(setSelectedIds: Dispatch<SetStateAction<Set<string>>>, rowId: string, checked: boolean) {
  setSelectedIds((current) => {
    const next = new Set(current);

    if (checked) {
      next.add(rowId);
    } else {
      next.delete(rowId);
    }

    return next;
  });
}

function deriveProductCandidates(analysis: AnalysisResult, suppliers?: SupplierOption[]): PreviewRowData[] {
  const productName = analysis.marketContext.productName;

  return analysis.opportunities.map((opportunity) => {
    const snapshot = getProductCandidateCommercialSnapshot(opportunity, analysis, suppliers);
    const currency = analysis.marketContext.currency ?? "USD";

    let commercialMeta: string | undefined;

    if (snapshot.hasAnyCommercialData) {
      const market = snapshot.hasMarketPrice ? snapshot.marketPrice : undefined;

      let supplierText: string | undefined;

      if (snapshot.supplierCostMin !== undefined && snapshot.supplierCostMax !== undefined) {
        if (snapshot.supplierCostMin === snapshot.supplierCostMax) {
          supplierText = formatMoneyLike(snapshot.supplierCostMin, currency);
        } else {
          supplierText = `${formatMoneyLike(snapshot.supplierCostMin, currency)}–${formatMoneyLike(
            snapshot.supplierCostMax,
            currency
          )}`;
        }
      }

      if (market && supplierText) {
        commercialMeta = `Market price: ${market} · Supplier cost: ${supplierText}`;
      } else if (market) {
        commercialMeta = `Market price: ${market} · Supplier cost unavailable`;
      } else if (supplierText) {
        commercialMeta = `Market price unavailable · Supplier cost: ${supplierText}`;
      } else if (snapshot.supplierOfferCount > 0) {
        commercialMeta = `Market price unavailable · ${snapshot.supplierOfferCount} supplier offers`;
      } else if (snapshot.deliveryEstimate) {
        commercialMeta = `Delivery: ${snapshot.deliveryEstimate}`;
      }
    }

    if (!commercialMeta) {
      commercialMeta = "Pricing unavailable";
    }

    return {
      id: `product-${opportunity.recommendationId}`,
      title: productName,
      summary: opportunity.primaryReason,
      risk: opportunity.riskLevel,
      confidence: opportunity.confidenceLevel,
      meta: commercialMeta,
      variant: "product"
    };
  });
}

function isPromoLikeText(text: string) {
  const lower = text.toLowerCase();
  return promoKeywords.some((keyword) => lower.includes(keyword));
}

function derivePromoCandidates(analysis: AnalysisResult): PreviewRowData[] {
  const promoOpportunities = analysis.opportunities.filter(
    (opportunity) =>
      isPromoLikeText(opportunity.recommendedAction) || isPromoLikeText(opportunity.primaryReason)
  );

  if (promoOpportunities.length > 0) {
    return promoOpportunities.map((opportunity) => ({
      id: opportunity.recommendationId,
      title: opportunity.recommendedAction,
      summary: opportunity.primaryReason,
      risk: opportunity.riskLevel,
      confidence: opportunity.confidenceLevel,
      meta: formatPromoMeta({
        recommendedAction: opportunity.recommendedAction,
        dataFreshness: opportunity.dataFreshness
      }),
      variant: "promo"
    }));
  }

  const promoFindings = analysis.assistantFindings.filter(
    (finding) => (finding.assistantId === "trend" || finding.assistantId === "competitor") && finding.signal !== "weak"
  );

  return promoFindings.map((finding) => ({
    id: `${finding.assistantId}-${finding.finding}`,
    title: finding.finding,
    summary: finding.reason,
    risk: finding.risk,
    confidence: finding.confidence,
    meta: formatPromoMeta({
      assistantId: finding.assistantId,
      dataFreshness: finding.dataFreshness,
      sourceLabel: finding.sourceLabel
    }),
    variant: "promo"
  }));
}

function deriveInventoryActions(analysis: AnalysisResult, selected: AnalysisResult["executiveRecommendation"]): PreviewRowData[] {
  if (analysis.assistantStatus?.inventory === "skipped") {
    return [];
  }

  const rows: PreviewRowData[] = [];
  const seenTitles = new Set<string>();
  const affectedLabel = analysis.marketContext.category || analysis.marketContext.productName;
  const affectedMeta = affectedLabel ? `Affected: ${affectedLabel}` : undefined;
  const inventoryContribution = selected.assistantContributions.find((contribution) => contribution.assistantId === "inventory");
  const shortActionTitle = inventoryContribution?.latestContribution;

  for (const finding of analysis.assistantFindings.filter((item) => item.assistantId === "inventory")) {
    if (seenTitles.has(finding.finding)) {
      continue;
    }

    seenTitles.add(finding.finding);
    rows.push({
      id: `finding-${finding.finding}`,
      title: inventoryDisplayTitle(finding.finding, shortActionTitle),
      summary: finding.reason,
      risk: finding.risk,
      confidence: finding.confidence,
      meta: affectedMeta,
      variant: "inventory"
    });
  }

  if (inventoryContribution && !seenTitles.has(inventoryContribution.latestContribution)) {
    rows.push({
      id: `contribution-${inventoryContribution.latestContribution}`,
      title: inventoryContribution.latestContribution,
      summary: inventoryContribution.summary,
      risk: inventoryContribution.risk,
      confidence: inventoryContribution.confidence,
      meta: affectedMeta,
      variant: "inventory"
    });
  }

  return rows;
}

function resolveDrawerDetail(
  row: PreviewRowData,
  analysis: AnalysisResult,
  suppliers: SupplierOption[],
  selected: AnalysisResult["executiveRecommendation"]
): DrawerDetail {
  const sourceMode = formatMode(analysis.sourceCollectionStatus.mode);
  const { category, productName, targetMarketplace } = analysis.marketContext;
  const defaultEvidence = analysis.evidencePackages[0];
  const defaultLinks = collectEvidenceLinks(selected, defaultEvidence, analysis);

  const supplierSourceStatus = analysis.supplierSourceStatus ?? deriveSupplierSourceState(analysis).status;

  const base: DrawerDetail = {
    rowId: row.id,
    variant: row.variant,
    title: row.title,
    summary: row.summary,
    category,
    marketplace: targetMarketplace,
    sourceMode,
    confidence: row.confidence,
    risk: row.risk,
    suppliers,
    supplierSourceStatus,
    evidence: defaultEvidence,
    evidenceLinks: defaultLinks,
    sourceUrlUnavailableReason: sourceUrlUnavailableReason(analysis, defaultEvidence, selected)
  };

  if (row.id.startsWith("product-")) {
    const recommendationId = row.id.replace("product-", "");
    const opportunity = analysis.opportunities.find((item) => item.recommendationId === recommendationId);
    const evidence = opportunity
      ? analysis.evidencePackages.find((item) => item.evidencePackageId === opportunity.evidencePackageId)
      : defaultEvidence;
    const evidenceLinks = collectEvidenceLinks(opportunity, evidence, analysis);

    const scopedSuppliers = suppliers.filter((supplier) => supplierMatchesCandidate(supplier, opportunity, evidence));

    return {
      ...base,
      suppliers: scopedSuppliers,
      title: productName,
      opportunityScore: opportunity?.opportunityScore,
      demand: opportunity?.demandSignal,
      estimatedMargin: opportunity?.estimatedMargin,
      recommendedAction: opportunity?.recommendedAction,
      suggestedNextStep: opportunity?.suggestedNextStep,
      whyItMatters: opportunity?.primaryReason ?? row.summary,
      expectedImpact: opportunity ? `${opportunity.matchQuality} match · ${opportunity.signalStrength} signal` : undefined,
      evidence,
      evidenceLinks,
      sourceUrlUnavailableReason: sourceUrlUnavailableReason(analysis, evidence, opportunity)
    };
  }

  if (row.id.startsWith("promo-")) {
    const innerId = row.id.replace("promo-", "");
    const opportunity = analysis.opportunities.find((item) => item.recommendationId === innerId);

    if (opportunity) {
      const evidence = analysis.evidencePackages.find((item) => item.evidencePackageId === opportunity.evidencePackageId);
      const evidenceLinks = collectEvidenceLinks(opportunity, evidence, analysis);

      return {
        ...base,
        title: row.title,
        targetProduct: productName,
        opportunityScore: opportunity.opportunityScore,
        demand: opportunity.demandSignal,
        estimatedMargin: opportunity.estimatedMargin,
        recommendedAction: opportunity.recommendedAction,
        suggestedNextStep: opportunity.suggestedNextStep,
        whyItMatters: opportunity.primaryReason,
        expectedImpact: `${opportunity.matchQuality} match · ${opportunity.signalStrength} signal`,
        evidence,
        evidenceLinks,
        sourceUrlUnavailableReason: sourceUrlUnavailableReason(analysis, evidence, opportunity)
      };
    }

    const finding = analysis.assistantFindings.find((item) => `${item.assistantId}-${item.finding}` === innerId);

    return {
      ...base,
      title: row.title,
      targetProduct: productName,
      demand: finding?.signal,
      recommendedAction: finding?.finding ?? row.title,
      whyItMatters: finding?.reason ?? row.summary,
      expectedImpact: finding ? `${finding.confidence} confidence · ${finding.signal} signal` : undefined,
      evidence: defaultEvidence
    };
  }

  if (row.id.startsWith("inventory-")) {
    const innerId = row.id.replace("inventory-", "");
    const affected = category || productName;
    const inventoryContribution = selected.assistantContributions.find((item) => item.assistantId === "inventory");

    if (innerId.startsWith("finding-")) {
      const findingText = innerId.replace("finding-", "");
      const finding = analysis.assistantFindings.find((item) => item.assistantId === "inventory" && item.finding === findingText);

      return {
        ...base,
        title: row.title,
        targetProduct: affected,
        recommendedAction: inventoryContribution?.latestContribution ?? row.title,
        whyItMatters: finding?.reason ?? row.summary,
        suggestedNextStep: inventoryContribution?.summary,
        expectedImpact: finding ? `${finding.confidence} confidence` : row.confidence ? `${row.confidence} confidence` : undefined,
        evidence: defaultEvidence
      };
    }

    return {
      ...base,
      title: row.title,
      targetProduct: affected,
      recommendedAction: inventoryContribution?.latestContribution ?? row.title,
      whyItMatters: row.summary,
      suggestedNextStep: inventoryContribution?.summary,
      expectedImpact: row.confidence ? `${row.confidence} confidence` : undefined,
      evidence: defaultEvidence
    };
  }

  return base;
}

function drawerTitleForVariant(variant: RowDisplayVariant) {
  if (variant === "product") {
    return "Product candidate detail";
  }

  if (variant === "promo") {
    return "Promo candidate detail";
  }

  return "Inventory action detail";
}

function hasExactSupplierProductMapping() {
  return false;
}

// When supplierProductMap is available, wire:
// - deselect confirmation
// - add-supplier confirmation
// - session "don't show again" flags (useState in ActiveTabContent)

function getSupplierRowId(supplier: SupplierOption, index: number) {
  return `supplier-${index}-${supplier.supplierName}-${supplier.source}`;
}

function formatItemsCovered(totalProductCandidates: number, selectedProductCandidates: number) {
  if (totalProductCandidates <= 0) {
    return "Coverage not available";
  }

  if (selectedProductCandidates > 0) {
    const noun = selectedProductCandidates === 1 ? "selected product" : "selected products";
    return `${selectedProductCandidates} of ${selectedProductCandidates} ${noun}`;
  }

  const noun = totalProductCandidates === 1 ? "product candidate" : "product candidates";
  return `${totalProductCandidates} of ${totalProductCandidates} ${noun}`;
}

function formatSupplierSelectedCount(count: number) {
  return count === 1 ? "1 supplier selected" : `${count} suppliers selected`;
}

function formatSupplierRisk(risk: SupplierOption["risk"] | undefined) {
  if (!risk) {
    return "Not rated";
  }

  return risk.charAt(0).toUpperCase() + risk.slice(1);
}

function formatDeliveryBatch(delivery: string | undefined) {
  if (!delivery?.trim()) {
    return "Not available";
  }

  return delivery;
}

function formatMatchQualityLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatCandidateUnitCost(evidence: EvidencePackage | undefined, supplier: SupplierOption) {
  if (isFiniteMoneyValue(evidence?.supplierPrice)) {
    return formatSupplierCost(evidence.supplierPrice);
  }

  return formatSupplierCost(supplier.estimatedUnitCost);
}

function resolveCandidateMatchQuality(
  opportunity: AnalysisResult["opportunities"][number] | undefined,
  evidence: EvidencePackage | undefined
) {
  if (opportunity?.matchQuality) {
    return formatMatchQualityLabel(opportunity.matchQuality);
  }

  if (evidence?.matchQuality) {
    return formatMatchQualityLabel(evidence.matchQuality);
  }

  return "Analysis-level";
}

function getDrawerCandidateProductRows(
  productRows: PreviewRowData[],
  selectedProductIds: Set<string>,
  supplier: SupplierOption,
  analysis: AnalysisResult
): SupplierCandidateProductRow[] {
  const visibleRows =
    selectedProductIds.size > 0 ? productRows.filter((row) => selectedProductIds.has(row.id)) : productRows;

  const seen = new Set<string>();

  return visibleRows
    .map((row) => {
      const recommendationId = row.id.replace(/^product-/, "");
      const opportunity = analysis.opportunities.find((item) => item.recommendationId === recommendationId);
      const evidence = opportunity
        ? analysis.evidencePackages.find((item) => item.evidencePackageId === opportunity.evidencePackageId)
        : undefined;

      return {
        key: candidateDedupeKey(row, opportunity, evidence),
        isLinked: supplierMatchesCandidate(supplier, opportunity, evidence),
        item: {
          productName: row.title,
          unitCost: formatCandidateUnitCost(evidence, supplier),
          delivery: formatDeliveryBatch(supplier.estimatedDeliveryTime),
          matchQuality: resolveCandidateMatchQuality(opportunity, evidence)
        } satisfies SupplierCandidateProductRow
      };
    })
    .filter((entry) => entry.isLinked)
    .filter((entry) => {
      if (seen.has(entry.key)) return false;
      seen.add(entry.key);
      return true;
    })
    .map((entry) => entry.item);
}

function resolveSupplierDeliveryCost(analysis: AnalysisResult, supplier: SupplierOption) {
  const matchedProduct = analysis.normalizedProducts?.find(
    (product) => product.supplierName === supplier.supplierName && product.deliveryCostNote?.trim()
  );

  if (matchedProduct?.deliveryCostNote) {
    return matchedProduct.deliveryCostNote;
  }

  return supplierDeliveryCostFallback;
}

function resolveSupplierDrawerDetail(
  supplier: SupplierOption,
  analysis: AnalysisResult,
  supplierId: string
): SupplierDrawerDetail {
  const evidence = analysis.evidencePackages.find((item) => supplierMatchesCandidate(supplier, undefined, item));
  const evidenceLinks = supplierEvidenceLinks(supplier, analysis, evidence);

  return {
    supplierId,
    supplier,
    sourceMode: formatMode(analysis.sourceCollectionStatus.mode),
    marketplace: analysis.marketContext.targetMarketplace,
    supplierPrice: evidence?.supplierPrice,
    brightDataProduct: evidence?.brightDataProduct,
    brightDataMode: evidence ? formatMode(evidence.brightDataMode) : undefined,
    riskInputs: evidence?.riskInputs,
    evidenceLinks,
    sourceUrlUnavailableReason: sourceUrlUnavailableReason(analysis, evidence, analysis.executiveRecommendation),
    rawRef: evidence?.rawRef
  };
}

function useDrawerLock(onClose: () => void) {
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [onClose]);
}

function fallbackSupplierOptions(analysis: AnalysisResult): SupplierOption[] {
  const evidence = analysis.evidencePackages[0];

  if (evidence?.supplierPrice === null || evidence?.supplierPrice === undefined) {
    return [];
  }

  return [
    {
      // This is a placeholder derived from marketplace evidence / supplier signals,
      // not a verified supplier store/catalog.
      supplierName: "Fallback supplier signal",
      source: `${analysis.marketContext.supplierSource} (fallback/partial)`,
      ...(getEvidenceExternalId(evidence) ? { externalId: getEvidenceExternalId(evidence) } : {}),
      evidenceRefIds: evidence ? [evidence.evidencePackageId] : [],
      ...(evidence?.rawSourceSnapshotId ? { rawSourceSnapshotId: evidence.rawSourceSnapshotId } : {}),
      estimatedUnitCost: evidence?.supplierPrice ?? null,
      estimatedDeliveryTime: "Validation required",
      availability: "unknown",
      ratingQualityProxy: "Unknown rating (not provided)",
      matchConfidence: evidence?.matchQuality ?? "medium",
      risk: "medium",
      isFallback: true
    }
  ];
}

export function RecommendationsClient() {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<StrategyTab>("Product Candidates");
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(() => new Set());
  const [selectedPromoIds, setSelectedPromoIds] = useState<Set<string>>(() => new Set());
  const [selectedInventoryIds, setSelectedInventoryIds] = useState<Set<string>>(() => new Set());
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<Set<string>>(() => new Set());
  const [exportPlaceholderMessage, setExportPlaceholderMessage] = useState<string>("");

  useEffect(() => {
    async function load() {
      const requestId = createDiagRequestId("recommendations_load");
      const params = new URLSearchParams(window.location.search);
      const runId = params.get("runId");
      const cached = window.localStorage.getItem("ami.latestAnalysis");
      let cachedRunId: string | undefined;

      if (cached) {
        try {
          cachedRunId = (JSON.parse(cached) as AnalysisResult).analysisRunId;
        } catch {
          cachedRunId = undefined;
        }
      }

      amiDiagLog("recommendations_load_started", {
        requestId,
        route: "/recommendations",
        runIdFromUrl: runId,
        runIdFromLocalStorage: cachedRunId
      });

      if (runId) {
        const response = await fetch(`/api/analysis/${runId}`);
        amiDiagLog("recommendations_run_fetch_response", {
          requestId,
          route: `/api/analysis/${runId}`,
          runIdFromUrl: runId,
          responseStatus: response.status,
          ok: response.ok
        });

        if (response.ok) {
          const result = (await response.json()) as AnalysisResult;
          setAnalysis(result);
          setSelectedId(result.executiveRecommendation.recommendationId);
          amiDiagLog("recommendations_latest_run_loaded", {
            requestId,
            analysisRunId: result.analysisRunId,
            route: "/recommendations",
            latestRunLoaded: true,
            recommendationSource: "api_run_id",
            sourceMode: result.sourceMode,
            usedFallback: result.fallbackUsed,
            dataQualityStatus: result.dataQualitySummary?.status
          });
          return;
        }
      }

      if (cached) {
        const result = JSON.parse(cached) as AnalysisResult;
        setAnalysis(result);
        setSelectedId(result.executiveRecommendation.recommendationId);
        amiDiagLog("recommendations_latest_run_loaded", {
          requestId,
          analysisRunId: result.analysisRunId,
          route: "/recommendations",
          latestRunLoaded: true,
          runIdFromUrl: runId,
          runIdFromLocalStorage: result.analysisRunId,
          recommendationSource: "localStorage_fallback",
          sourceMode: result.sourceMode,
          usedFallback: result.fallbackUsed,
          dataQualityStatus: result.dataQualitySummary?.status
        });
        return;
      }

      amiDiagLog("recommendations_no_run_available", {
        requestId,
        route: "/recommendations",
        latestRunLoaded: false
      });
      router.push("/market-context-setup");
    }

    load();
  }, [router]);

  const selected = useMemo(() => {
    if (!analysis) {
      return null;
    }

    return analysis.opportunities.find((recommendation) => recommendation.recommendationId === selectedId) ?? analysis.executiveRecommendation;
  }, [analysis, selectedId]);

  if (!analysis) {
    return (
      <PageShell>
        <Surface className="p-6">
          <div className="flex flex-col items-start gap-4">
            <h2 className="text-xl font-semibold text-[var(--text)]">AMI Strategy</h2>
            <p className="text-sm text-[var(--text-secondary)]">No analysis found for this session.</p>
            <p className="text-sm text-[var(--text-tertiary)]">
              No recommendation data is available for this session. Return to briefing and start a new AMI analysis.
            </p>
            <div>
              <button
                type="button"
                onClick={() => router.push("/market-context-setup")}
                className="mt-3 inline-flex items-center rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
              >
                Return to briefing
              </button>
            </div>
          </div>
        </Surface>
      </PageShell>
    );
  }

  if (!selected) {
    return (
      <PageShell>
        <Surface className="p-6">
          <div className="flex flex-col items-start gap-4">
            <h2 className="text-xl font-semibold text-[var(--text)]">AMI Strategy</h2>
            <p className="text-sm text-[var(--text-secondary)]">No recommendation is available yet.</p>
            <p className="text-sm text-[var(--text-tertiary)]">
              AMI could not identify a selected recommendation from the current analysis data. Return to briefing to
              review the market context and run a new analysis.
            </p>
            <div>
              <button
                type="button"
                onClick={() => router.push("/market-context-setup")}
                className="mt-3 inline-flex items-center rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
              >
                Return to briefing
              </button>
            </div>
          </div>
        </Surface>
      </PageShell>
    );
  }

  const sourceState = sourceStateForAnalysis(analysis);
  const evidence = analysis.evidencePackages.find((item) => item.evidencePackageId === selected.evidencePackageId);
  const selectedEvidenceLinks = collectEvidenceLinks(selected, evidence, analysis);
  const selectedSourceUnavailableReason = sourceUrlUnavailableReason(analysis, evidence, selected);
  const suppliers = analysis.supplierOptions?.length ? analysis.supplierOptions : fallbackSupplierOptions(analysis);
  const strategySignals =
    analysis.assistantFindings.length > 0
      ? analysis.assistantFindings
      : selected.assistantContributions.map((contribution) => ({
          assistantId: contribution.assistantId,
          finding: contribution.latestContribution,
          reason: contribution.summary,
          risk: contribution.risk,
          confidence: contribution.confidence
        }));
  const qualityNotice = dataQualityCopy(analysis);
  const totalSelectedCount =
    selectedProductIds.size + selectedPromoIds.size + selectedInventoryIds.size + selectedSupplierIds.size;
  const defaultExportMessage = totalSelectedCount > 0 ? "Ready to export selected report." : "";

  const handleExportReport = () => {
    if (totalSelectedCount === 0) {
      setExportPlaceholderMessage("Select at least one recommendation before exporting the report.");
      return;
    }

    setExportPlaceholderMessage("Preparing report...");

    const selectedProductOpportunities = getSelectedProductOpportunities(analysis, selectedProductIds);
    const selectedPromoItems = getSelectedPromoItems(analysis, selectedPromoIds);
    const selectedInventoryItems = getSelectedInventoryItems(analysis, selectedInventoryIds, selected);
    const selectedSupplierOptions = getSelectedSupplierOptions(suppliers, selectedSupplierIds);
    const evidenceLinksForReport = getEvidenceLinksForReport(analysis, selected, evidence);
    const reportHtml = buildPrintableReportHtml({
      analysis,
      selectedProductOpportunities,
      selectedPromoItems,
      selectedInventoryItems,
      selectedSupplierOptions,
      qualityNotice,
      evidenceLinks: evidenceLinksForReport
    });

    const reportWindow = window.open("", "_blank");

    if (!reportWindow) {
      setExportPlaceholderMessage("Unable to open the report window. Please allow pop-ups and try again.");
      return;
    }

    reportWindow.document.open();
    reportWindow.document.write(reportHtml);
    reportWindow.document.close();
    reportWindow.document.title = "AMI Marketplace Report";
    reportWindow.addEventListener("load", () => {
      reportWindow.focus();
      reportWindow.print();
    });

    setExportPlaceholderMessage("Report opened. Use your browser print dialog to save it as PDF.");
  };
  const promoCandidateCount = analysis.assistantFindings.filter(
    (finding) => (finding.assistantId === "trend" || finding.assistantId === "competitor") && finding.signal !== "weak"
  ).length;
  const inventoryActionCount = analysis.assistantFindings.filter(
    (finding) => finding.assistantId === "inventory" && analysis.assistantStatus?.inventory !== "skipped"
  ).length;

  return (//<--- aqui abre
    <PageShell>
      <section className="border-b border-slate-200 pb-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <Badge tone="teal">AMI Strategy</Badge>
            <p className="mt-5 text-xs font-semibold uppercase text-slate-500">Business goal</p>
            <h1 className="mt-2 text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
              {goalLabel(analysis.marketContext.businessGoal)}
            </h1>
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-slate-600">
              <span>
                <span className="font-semibold text-slate-950">Last analysis:</span>{" "}
                {analysis.completedAt ? new Date(analysis.completedAt).toLocaleString() : "Pending"}
              </span>
              <span>
                <span className="font-semibold text-slate-950">Source mode:</span>{" "}
                {sourceState.sourceLabel}
              </span>
              <BrightDataPill />
            </div>
          </div>

          <div className="flex w-full flex-wrap gap-3 lg:w-auto lg:justify-end">
            <Counter label="Product Candidates" value={analysis.opportunities.length} />
            <Counter label="Promo Candidates" value={promoCandidateCount} />
            <Counter label="Inventory Actions" value={inventoryActionCount} />
          </div>
        </div>
      </section>

      {analysis.warnings?.length > 0 && (
        <section className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-1 text-amber-800" size={20} />
            <p className="text-sm leading-6 text-amber-950">{safeDisplay(analysis.warnings[0], 360)}</p>
          </div>
        </section>
      )}

      {/* <Section className="border-b border-slate-200 pb-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Final recommendation</p>
            <h2 className="mt-2 text-2xl font-semibold leading-tight text-slate-950">{selected.recommendedAction}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              {selected.reasoningSummary ?? selected.primaryReason}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone="teal">Score {selected.finalScore !== undefined ? Math.round(selected.finalScore * 100) : selected.opportunityScore}</Badge>
              <Badge tone={riskBadgeTone(selected.risk ?? selected.riskLevel)}>Risk {selected.risk ?? selected.riskLevel}</Badge>
              <Badge tone="blue">
                Confidence {selected.confidence !== undefined ? Math.round(selected.confidence * 100) : selected.confidenceLevel}
              </Badge>
              {selected.opportunityType && <Badge tone="neutral">{selected.opportunityType.replace(/_/g, " ")}</Badge>}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase text-slate-500">Primary metrics</p>
            <dl className="mt-3 flex flex-col gap-2 text-sm">
              <MetricLine label="Demand" value={selected.metrics.demandScore !== undefined && selected.metrics.demandScore !== null ? `${Math.round(selected.metrics.demandScore * 100)}/100` : selected.demandSignal} />
              <MetricLine label="Trend" value={selected.metrics.trendMomentum !== undefined && selected.metrics.trendMomentum !== null ? `${Math.round(selected.metrics.trendMomentum * 100)}/100` : selected.signalStrength} />
              <MetricLine label="Supplier" value={selected.metrics.supplierAvailability !== undefined && selected.metrics.supplierAvailability !== null ? `${Math.round(selected.metrics.supplierAvailability * 100)}/100` : "Validation required"} />
              <MetricLine label="Est. margin" value={selected.metrics.estimatedGrossMarginPct !== undefined && selected.metrics.estimatedGrossMarginPct !== null ? `${Math.round(selected.metrics.estimatedGrossMarginPct * 100)}%` : formatMargin(selected.estimatedMargin) ?? "Unknown"} />
              <MetricLine label="ROI" value={selected.metrics.estimatedROI !== undefined && selected.metrics.estimatedROI !== null ? `${Math.round(selected.metrics.estimatedROI * 100)}%` : "Unknown"} />
            </dl>
          </div>
        </div>
      </Section> */}

      

      <Section className="border-b border-slate-200 pb-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">AMI Strategy Signals | Category: {analysis.marketContext.category}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Interpreted signals explaining why AMI detected a strategic opening in this market context.
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-4">
          {strategySignals.map((signal) => {
            const assistant = VisibleAssistants.find((item) => item.id === signal.assistantId);

            return (
              <div
                key={`${signal.assistantId}-${signal.finding}`}
                className="flex flex-col gap-3 border-b border-slate-100 py-3 last:border-b-0 sm:flex-row sm:items-start"
              >
                <div className="min-w-32">
                  <Badge tone={riskBadgeTone(signal.risk)}>
                    {signal.risk} risk
                  </Badge>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-950">{signal.finding}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{signal.reason}</p>
                  {assistant && <p className="mt-1 text-xs font-semibold uppercase text-slate-400">{assistant.name}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {qualityNotice && (
        <section className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-1 text-amber-800" size={20} />
            <div>
              <p className="text-sm font-semibold text-amber-950">{qualityNotice.title}</p>
              <p className="mt-1 text-sm leading-6 text-amber-950">{qualityNotice.body}</p>
            </div>
          </div>
        </section>
      )}

      {/* <section className="mt-5 rounded-lg border border-slate-200 bg-white p-4">
        <EvidenceLinksPanel
          links={selectedEvidenceLinks}
          unavailableReason={selectedSourceUnavailableReason}
          rawRef={evidence?.rawRef}
        />
      </section> */}
  
      <Section className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Partner’s Choice</p>
            <p className="mt-2 text-sm font-semibold text-slate-950">
              {`Partner’s Choice: ${selectedProductIds.size + selectedPromoIds.size + selectedInventoryIds.size} selected ${selectedProductIds.size + selectedPromoIds.size + selectedInventoryIds.size === 1 ? "item" : "items"} | ${selectedSupplierIds.size} ${selectedSupplierIds.size === 1 ? "supplier" : "suppliers"}`}
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              {selectedProductIds.size + selectedPromoIds.size + selectedInventoryIds.size + selectedSupplierIds.size > 0
                ? "Review selections before exporting the final report."
                : "Select product candidates, actions, or suppliers to prepare Partner’s Choice."}
            </p>
          </div>

          <div className="flex flex-col items-start gap-2 sm:items-end">
            <button
              type="button"
              onClick={handleExportReport}
              disabled={totalSelectedCount === 0}
              className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Export AMI Report
            </button>
            <p className="text-xs leading-5 text-slate-600">{exportPlaceholderMessage || defaultExportMessage}</p>
          </div>
        </div>
      </Section>

      <Section>
        <div className="flex flex-wrap gap-2 border-b border-slate-200">
          {strategyTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`min-h-11 border-b-2 px-3 py-2 text-sm font-semibold transition ${
                activeTab === tab
                  ? "border-teal-600 text-teal-800"
                  : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-950"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <Surface className="mt-5">
          <ActiveTabContent
            activeTab={activeTab}
            analysis={analysis}
            selected={selected}
            evidence={evidence}
            suppliers={suppliers}
            selectedProductIds={selectedProductIds}
            selectedPromoIds={selectedPromoIds}
            selectedInventoryIds={selectedInventoryIds}
            selectedSupplierIds={selectedSupplierIds}
            setSelectedProductIds={setSelectedProductIds}
            setSelectedPromoIds={setSelectedPromoIds}
            setSelectedInventoryIds={setSelectedInventoryIds}
            setSelectedSupplierIds={setSelectedSupplierIds}
          />
        </Surface>
      </Section>

      <section className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-1 text-amber-800" size={20} />
          <p className="text-sm leading-6 text-amber-950">
            AMI does not automate purchasing. Approved recommendations are stored as decision history inside Control Hub.
          </p>
        </div>
      </section>
    </PageShell>
  );//<----aqui
}

function EvidenceLinksPanel({
  links,
  unavailableReason,
  rawRef
}: {
  links: EvidenceLink[];
  unavailableReason: string;
  rawRef?: string;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-950">Evidence / Source links</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">Reviewable source references tied to this recommendation.</p>
        </div>
        <FileSearch size={18} className="text-slate-500" />
      </div>

      {links.length > 0 ? (
        <div className="mt-3 flex flex-col gap-2">
          {links.map((link) => (
            <a
              key={`${link.url}-${link.label}`}
              href={link.url}
              target="_blank"
              rel="noreferrer noopener"
              className="group flex items-start justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm transition hover:border-teal-300 hover:bg-teal-50"
            >
              <span className="min-w-0">
                <span className="block font-semibold text-teal-800 group-hover:text-teal-950">{safeDisplay(link.label, 80)}</span>
                <span className="mt-0.5 block break-all text-xs leading-5 text-slate-600">{safeDisplay(link.sourceName, 120)}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {link.sourceStatus && <Badge tone={sourceStatusTone(link.sourceStatus)}>{link.sourceStatus}</Badge>}
                <ExternalLink size={15} className="text-teal-700" />
              </span>
            </a>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm leading-6 text-slate-700">{unavailableReason}</p>
      )}

      {rawRef && (
        <p className="mt-3 break-all text-xs leading-5 text-slate-500">
          Raw source snapshot reference: {safeDisplay(rawRef, 220)}
        </p>
      )}
    </div>
  );
}

function Counter({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-36 border-l-2 border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function ActiveTabContent({
  activeTab,
  analysis,
  selected,
  evidence,
  suppliers,
  selectedProductIds,
  selectedPromoIds,
  selectedInventoryIds,
  selectedSupplierIds,
  setSelectedProductIds,
  setSelectedPromoIds,
  setSelectedInventoryIds,
  setSelectedSupplierIds
}: {
  activeTab: StrategyTab;
  analysis: AnalysisResult;
  selected: AnalysisResult["executiveRecommendation"];
  evidence: AnalysisResult["evidencePackages"][number] | undefined;
  suppliers: SupplierOption[];
  selectedProductIds: Set<string>;
  selectedPromoIds: Set<string>;
  selectedInventoryIds: Set<string>;
  selectedSupplierIds: Set<string>;
  setSelectedProductIds: Dispatch<SetStateAction<Set<string>>>;
  setSelectedPromoIds: Dispatch<SetStateAction<Set<string>>>;
  setSelectedInventoryIds: Dispatch<SetStateAction<Set<string>>>;
  setSelectedSupplierIds: Dispatch<SetStateAction<Set<string>>>;
}) {
  const [productPage, setProductPage] = useState(0);
  const [promoPage, setPromoPage] = useState(0);
  const [inventoryPage, setInventoryPage] = useState(0);

  const productRows = useMemo(() => deriveProductCandidates(analysis, suppliers), [analysis, suppliers]);
  const promoRows = useMemo(
    () => derivePromoCandidates(analysis).map((row) => ({ ...row, id: `promo-${row.id}` })),
    [analysis]
  );
  const inventoryRows = useMemo(
    () => deriveInventoryActions(analysis, selected).map((row) => ({ ...row, id: `inventory-${row.id}` })),
    [analysis, selected]
  );

  // Explicit supplier-native source status. Prefer the authoritative status the
  // backend now persists; fall back to client derivation for older runs that
  // predate the field. Never inferred from `supplierOptions.length === 0`.
  const supplierSourceStatus = analysis.supplierSourceStatus ?? deriveSupplierSourceState(analysis).status;

  // Per-supplier count of product candidate rows matched via evidence linking.
  // Derived from productRows x suppliers — no external data needed.
  const supplierCatalogMatchCounts = useMemo<Record<string, number>>(() => {
    const counts: Record<string, number> = {};
    for (const [index, supplier] of suppliers.entries()) {
      const supplierId = getSupplierRowId(supplier, index);
      let count = 0;
      for (const row of productRows) {
        const recommendationId = row.id.replace(/^product-/, "");
        const opportunity = analysis.opportunities.find((o) => o.recommendationId === recommendationId);
        const evidence = opportunity
          ? analysis.evidencePackages.find((e) => e.evidencePackageId === opportunity.evidencePackageId)
          : undefined;
        if (supplierMatchesCandidate(supplier, opportunity, evidence)) {
          count += 1;
        }
      }
      counts[supplierId] = count;
    }
    return counts;
  }, [suppliers, productRows, analysis]);

  const [drawerDetail, setDrawerDetail] = useState<DrawerDetail | null>(null);
  const [supplierDrawer, setSupplierDrawer] = useState<SupplierDrawerDetail | null>(null);

  const handleSupplierToggle = (supplierId: string, checked: boolean) => {
    if (hasExactSupplierProductMapping()) {
      // Future: confirmation modals and product sync when exact mapping exists.
      return;
    }

    toggleSelection(setSelectedSupplierIds, supplierId, checked);
  };

  const openDrawer = (row: PreviewRowData) => {
    setDrawerDetail(resolveDrawerDetail(row, analysis, suppliers, selected));
  };

  const drawerIsSelected = drawerDetail
    ? (activeTab === "Product Candidates" && selectedProductIds.has(drawerDetail.rowId)) ||
      (activeTab === "Promo Candidates" && selectedPromoIds.has(drawerDetail.rowId)) ||
      (activeTab === "Inventory Actions" && selectedInventoryIds.has(drawerDetail.rowId))
    : false;

  const drawerNode = drawerDetail ? (
    <ItemDetailDrawer detail={drawerDetail} isSelected={drawerIsSelected} onClose={() => setDrawerDetail(null)} />
  ) : null;

  if (activeTab === "Product Candidates") {
    return (
      <>
        <SelectablePaginatedTab
          title="Product Candidates"
          description="Product candidates generated from this analysis."
          rows={productRows}
          rowLabel="product candidates"
          selectedIds={selectedProductIds}
          onToggle={(rowId, checked) => toggleSelection(setSelectedProductIds, rowId, checked)}
          onViewDetails={openDrawer}
          page={productPage}
          onPageChange={setProductPage}
          emptyState={
            <LimitedDataState message="Product candidates generated from this analysis will appear here when available." />
          }
        />
        {drawerNode}
      </>
    );
  }

  if (activeTab === "Promo Candidates") {
    return (
      <>
        <SelectablePaginatedTab
          title="Promo Candidates"
          description="Promotion-oriented suggestions from trend, competitor, and market timing signals in this analysis."
          rows={promoRows}
          rowLabel="promo candidates"
          selectedIds={selectedPromoIds}
          onToggle={(rowId, checked) => toggleSelection(setSelectedPromoIds, rowId, checked)}
          onViewDetails={openDrawer}
          page={promoPage}
          onPageChange={setPromoPage}
          emptyState={
            <LimitedDataState
              message="Promotion candidates are not available for this analysis yet."
              detail="AMI found market signals that may support future promotion planning, but no dedicated promotion output has been generated."
            />
          }
        />
        {drawerNode}
      </>
    );
  }

  if (activeTab === "Inventory Actions") {
    return (
      <>
        <SelectablePaginatedTab
          title="Inventory Actions"
          description="Inventory actions generated from workspace context and market signals."
          rows={inventoryRows}
          rowLabel="inventory actions"
          selectedIds={selectedInventoryIds}
          onToggle={(rowId, checked) => toggleSelection(setSelectedInventoryIds, rowId, checked)}
          onViewDetails={openDrawer}
          page={inventoryPage}
          onPageChange={setInventoryPage}
          emptyState={
            <LimitedDataState
              message="No dedicated inventory actions were generated for this analysis."
              detail="AMI will show inventory actions here when workspace inventory context produces operational recommendations."
            />
          }
        />
        {drawerNode}
      </>
    );
  }

  if (activeTab === "Supplier Comparison") {
    return (
      <>
        <div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <TabHeader
              title="Supplier Comparison"
              description="Compare supplier options connected to this analysis and select suppliers to prepare Partner's Choice coverage."
            />
            <p className="text-sm text-slate-600">{formatSupplierSelectedCount(selectedSupplierIds.size)}</p>
          </div>
          {suppliers.length > 0 && (
            <p className="mb-4 text-xs text-[var(--text-tertiary)]">{suppliers.length} suppliers found · ranked by match confidence</p>
          )}
          {selectedProductIds.size > 0 ? (
            <p className="mt-3 text-sm text-slate-600">
              Supplier coverage is currently scoped to selected product candidates.
            </p>
          ) : (
            <p className="mt-3 text-sm text-slate-600">
              Select product candidates to preview selected-product supplier coverage.
            </p>
          )}
          {selectedSupplierIds.size > 0 && selectedProductIds.size === 0 && (
            <p className="mt-2 text-sm text-slate-600">
              Supplier selected. Select product candidates manually to prepare Partner&apos;s Choice coverage.
            </p>
          )}
          {suppliers.length > 0 ? (
            <SupplierComparisonTable
              suppliers={suppliers}
              selectedSupplierIds={selectedSupplierIds}
              catalogMatchCounts={supplierCatalogMatchCounts}
              onToggleSupplier={handleSupplierToggle}
              onSeeDetails={(supplier, supplierId) =>
                setSupplierDrawer(resolveSupplierDrawerDetail(supplier, analysis, supplierId))
              }
            />
          ) : (
            <p className="mt-4 text-sm text-slate-600">
              {SUPPLIER_SOURCE_EMPTY_COPY[supplierSourceStatus]}
            </p>
          )}
        </div>
        {supplierDrawer && (
          <SupplierDetailDrawer
            detail={supplierDrawer}
            isSelected={selectedSupplierIds.has(supplierDrawer.supplierId)}
            productRows={productRows}
            selectedProductIds={selectedProductIds}
            analysis={analysis}
            onClose={() => setSupplierDrawer(null)}
          />
        )}
      </>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabHeader
          title="Evidence & Reasoning"
          description="Validation layer for this analysis, including assistant reasoning, source evidence, product matching, and technical processing details."
        />
        <BrightDataPill />
      </div>

      {/* lightweight context line: evidence sources and assistant list */}
      {(() => {
        const sourcesCount = analysis.evidenceRefs?.length ?? analysis.evidencePackages?.length ?? 0;
        const assistantNames = selected.assistantContributions
          .map((c) => VisibleAssistants.find((item) => item.id === c.assistantId)?.name)
          .filter(Boolean) as string[];

        if (assistantNames.length > 0) {
          return (
            <p className="mb-4 text-xs text-[var(--text-tertiary)]">{sourcesCount} sources · from {assistantNames.join(", ")}</p>
          );
        }

        return (
          <p className="mb-4 text-xs text-[var(--text-tertiary)]">{sourcesCount} sources · from available assistant evidence</p>
        );
      })()}

      <details className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4" open>
        <summary className="flex items-center justify-between text-sm font-semibold text-slate-950">
          Source evidence
          <FileSearch size={18} />
        </summary>
        {evidence ? (
          <>
            <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
              <EvidenceLinksPanel
                links={collectEvidenceLinks(selected, evidence, analysis)}
                unavailableReason={sourceUrlUnavailableReason(analysis, evidence, selected)}
                rawRef={evidence.rawRef}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-700">
              <Comparison label="Product identity" value={evidence.productIdentity} />
              <Comparison label="Source marketplace" value={evidence.sourceMarketplace} />
              <Comparison label="Source mode" value={formatMode(evidence.brightDataMode)} />
              <Comparison label="Bright Data product" value={evidence.brightDataProduct} />
              <Comparison label="Current price" value={formatNullableMoney(evidence.currentPrice)} />
              <Comparison label="Supplier price" value={formatNullableMoney(evidence.supplierPrice)} />
              <Comparison label="Matched attributes" value={evidence.matchedAttributes.join(", ")} />
              <Comparison label="Demand indicators" value={evidence.demandIndicators.join(", ")} />
              <Comparison label="Risk inputs" value={evidence.riskInputs.join(", ")} />
              <Comparison label="Evidence package" value={evidence.evidencePackageId} />
            </div>
          </>
        ) : (
          <p className="mt-4 text-sm text-slate-600">Assistant reasoning, source evidence, product match, and technical details will appear here.</p>
        )}
      </details>

      <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <summary className="flex items-center justify-between text-sm font-semibold text-slate-950">
          Assistant reasoning and technical details
          <ChevronRight size={18} />
        </summary>
        <div className="mt-4 flex flex-col gap-4">
          {selected.assistantContributions.map((contribution) => {
            const assistant = VisibleAssistants.find((item) => item.id === contribution.assistantId);

            return (
              <div key={contribution.assistantId} className="border-b border-slate-200 pb-4 last:border-b-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-950">{assistant?.name ?? contribution.assistantId}</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={assistantTone(analysis.assistantStatus?.[contribution.assistantId])}>
                      {formatMode(analysis.assistantStatus?.[contribution.assistantId] ?? "completed")}
                    </Badge>
                    <Badge tone={riskBadgeTone(contribution.risk)}>
                      {contribution.confidence}
                    </Badge>
                  </div>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{contribution.summary}</p>
                <p className="mt-2 text-sm font-semibold text-slate-800">{contribution.latestContribution}</p>
              </div>
            );
          })}
          <div className="flex flex-wrap gap-3 text-sm text-slate-700">
            <Comparison label="Analysis run" value={analysis.analysisRunId} />
            <Comparison label="Collection mode" value={formatMode(analysis.sourceCollectionStatus.mode)} />
            <Comparison label="Collected at" value={new Date(analysis.sourceCollectionStatus.collectedAt).toLocaleString()} />
            <Comparison label="Status" value={analysis.status} />
          </div>
        </div>
      </details>
    </div>
  );
}

function SelectablePaginatedTab({
  title,
  description,
  rows,
  rowLabel,
  selectedIds,
  onToggle,
  onViewDetails,
  page,
  onPageChange,
  emptyState
}: {
  title: string;
  description: string;
  rows: PreviewRowData[];
  rowLabel: string;
  selectedIds: Set<string>;
  onToggle: (rowId: string, checked: boolean) => void;
  onViewDetails: (row: PreviewRowData) => void;
  page: number;
  onPageChange: (page: number) => void;
  emptyState: ReactNode;
}) {
  const { pageSize, columns } = useViewportPagination();
  const total = rows.length;
  const pageCount = getPageCount(total, pageSize);
  const effectivePage = pageCount > 0 ? Math.min(page, pageCount - 1) : 0;
  const pageRows = getPageSlice(rows, effectivePage, pageSize);
  const rangeStart = total === 0 ? 0 : effectivePage * pageSize + 1;
  const rangeEnd = total === 0 ? 0 : Math.min((effectivePage + 1) * pageSize, total);

  useEffect(() => {
    if (effectivePage !== page) {
      onPageChange(effectivePage);
    }
  }, [effectivePage, page, onPageChange]);

  const gridClass = columns === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1";

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <TabHeader title={title} description={description} />
        <p className="text-sm text-slate-600">{selectedIds.size} selected</p>
      </div>

      {/* lightweight context line for clarity (low emphasis) */}
      {(() => {
        if (title === "Product Candidates") {
          return <p className="mb-4 text-xs text-[var(--text-tertiary)]">{total} product opportunities · ranked by confidence</p>;
        }

        if (title === "Promo Candidates") {
          return <p className="mb-4 text-xs text-[var(--text-tertiary)]">{total} promo opportunities · ranked by market signal</p>;
        }

        if (title === "Inventory Actions") {
          return <p className="mb-4 text-xs text-[var(--text-tertiary)]">{total} inventory actions · ranked by urgency</p>;
        }

        return null;
      })()}

      {total === 0 ? (
        <div className="mt-4">{emptyState}</div>
      ) : (
        <>
          <div className={`mt-4 grid gap-x-6 ${gridClass}`}>
            {pageRows.map((row) => (
              <PreviewRow
                key={row.id}
                title={row.title}
                summary={row.summary}
                risk={row.risk}
                confidence={row.confidence}
                meta={row.meta}
                variant={row.variant}
                selectable
                checked={selectedIds.has(row.id)}
                onCheckedChange={(checked) => onToggle(row.id, checked)}
                onViewDetails={() => onViewDetails(row)}
              />
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <p className="text-sm text-slate-600">{formatRange(rangeStart, rangeEnd, total, rowLabel)}</p>
            {pageCount > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onPageChange(Math.max(0, effectivePage - 1))}
                  disabled={effectivePage === 0}
                  className="inline-flex min-h-9 items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={16} />
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => onPageChange(Math.min(pageCount - 1, effectivePage + 1))}
                  disabled={effectivePage >= pageCount - 1}
                  className="inline-flex min-h-9 items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function PreviewRow({
  title,
  summary,
  risk,
  confidence,
  meta,
  variant,
  selectable = false,
  checked = false,
  onCheckedChange,
  onViewDetails
}: {
  title: string;
  summary: string;
  risk: DisplayRisk;
  confidence?: "low" | "medium" | "high";
  meta?: string;
  variant?: RowDisplayVariant;
  selectable?: boolean;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  onViewDetails?: () => void;
}) {
  if (selectable && variant) {
    return (
      <div className="flex items-start gap-2 border-b border-slate-100 py-2 last:border-b-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onCheckedChange?.(event.target.checked)}
          aria-label={`Select ${title}`}
          className="mt-0.5 size-4 shrink-0 rounded border-slate-300 text-teal-600 focus:ring-teal-600"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-950">{title}</p>
          {meta && <p className="mt-0.5 text-xs text-slate-500">{meta}</p>}
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onViewDetails?.();
          }}
          className="shrink-0 text-xs font-semibold text-teal-700 hover:text-teal-900"
        >
          View details
        </button>
      </div>
    );
  }

  const content = (
    <div className="min-w-0 flex-1">
      <p className="text-sm font-semibold text-slate-950">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-600">{summary}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
        <Badge tone={riskBadgeTone(risk)}>{risk} risk</Badge>
        {confidence && <Badge tone="blue">{confidence} confidence</Badge>}
        {meta && <span className="text-slate-500">{meta}</span>}
      </div>
    </div>
  );

  return <div className="border-b border-slate-100 py-3 last:border-b-0">{content}</div>;
}

function ItemDetailDrawer({
  detail,
  isSelected,
  onClose
}: {
  detail: DrawerDetail;
  isSelected: boolean;
  onClose: () => void;
}) {
  useDrawerLock(onClose);

  const marginLabel =
    // Do not display margin for product candidate drawers (MVP rule)
    detail.variant === "product"
      ? undefined
      : detail.estimatedMargin !== undefined && detail.estimatedMargin > 0
      ? `Est. margin ${detail.estimatedMargin.toFixed(1)}%`
      : undefined;

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" className="absolute inset-0 bg-slate-950/40" aria-label="Close drawer" onClick={onClose} />
      <aside
        className="absolute inset-0 flex flex-col bg-white md:inset-y-0 md:left-auto md:right-0 md:w-full md:max-w-lg md:border-l md:border-slate-200 md:shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 md:px-6">
          <div className="min-w-0">
            <h3 id="drawer-title" className="text-lg font-semibold text-slate-950">
              {drawerTitleForVariant(detail.variant)}
            </h3>
            <p className="mt-1 text-sm font-semibold text-slate-800">{detail.title}</p>
            <p className="mt-1 text-xs font-semibold uppercase text-slate-500">{isSelected ? "Selected" : "Not selected"}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 p-2 text-slate-700 hover:border-slate-300 hover:text-slate-950"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5 md:px-6">
          <section>
            <h4 className="text-sm font-semibold text-slate-950">
              {detail.variant === "product"
                ? "Product / action summary"
                : detail.variant === "promo"
                  ? "Promo / action summary"
                  : "Inventory action summary"}
            </h4>
            <dl className="mt-3 flex flex-col gap-2">
              {detail.variant === "product" && (
                <>
                  <DrawerField label="Product / candidate name" value={detail.title} />
                  <DrawerField label="Category" value={detail.category} />
                  <DrawerField label="Marketplace" value={detail.marketplace} />
                </>
              )}
              {detail.variant === "promo" && (
                <>
                  <DrawerField label="Promo / action name" value={detail.title} />
                  <DrawerField label="Target product or category" value={detail.targetProduct ?? detail.category} />
                </>
              )}
              {detail.variant === "inventory" && (
                <>
                  <DrawerField label="Inventory action name" value={detail.title} />
                  <DrawerField label="Affected product or category" value={detail.targetProduct ?? detail.category} />
                </>
              )}
              <DrawerField label="Source mode" value={detail.sourceMode} />
              <DrawerField label="Selected status" value={isSelected ? "Selected" : "Not selected"} />
            </dl>
          </section>

          {/* Commercial snapshot inserted for product candidates */}
          {detail.variant === "product" && (
            <section className="mt-6 border-t border-slate-100 pt-5">
              <h4 className="text-sm font-semibold text-slate-950">Commercial snapshot</h4>
              <div className="mt-3">
                {(() => {
                  const snapshot = getCommercialSnapshotFromEvidence(detail.evidence, detail.suppliers, detail.evidence?.currency);
                  const currency = detail.evidence?.currency ?? "USD";

                  if (!snapshot.hasAnyCommercialData) {
                    return <p className="mt-2 text-sm text-slate-600">Pricing data was not available from the current source records.</p>;
                  }

                  const supplierText = snapshot.supplierCostMin !== undefined && snapshot.supplierCostMax !== undefined
                    ? snapshot.supplierCostMin === snapshot.supplierCostMax
                      ? formatMoneyLike(snapshot.supplierCostMin, currency)
                      : `${formatMoneyLike(snapshot.supplierCostMin, currency)}–${formatMoneyLike(snapshot.supplierCostMax, currency)}`
                    : undefined;

                  return (
                    <dl className="mt-2 flex flex-col gap-2">
                      <DrawerField label="Market price" value={snapshot.marketPrice ?? "Not available"} />
                      <DrawerField label="Supplier cost" value={supplierText ?? "Unknown"} />
                      {!snapshot.hasSupplierCost && (
                        <p className="mt-1 text-xs text-slate-600">Margin cannot be estimated until supplier cost is validated.</p>
                      )}
                      {snapshot.supplierOfferCount > 0 && (
                        <DrawerField label="Supplier offers" value={`${snapshot.supplierOfferCount} offer${snapshot.supplierOfferCount === 1 ? "" : "s"}`} />
                      )}
                      {snapshot.deliveryEstimate && <DrawerField label="Delivery estimate" value={String(snapshot.deliveryEstimate)} />}
                      {(snapshot.hasSupplierCost || snapshot.supplierOfferCount > 0) && (
                        <p className="mt-3 text-xs text-slate-600">Supplier cost does not include freight, import fees, taxes, or marketplace fees.</p>
                      )}
                    </dl>
                  );
                })()}
              </div>
            </section>
          )}

          <section className="mt-6 border-t border-slate-100 pt-5">
            <h4 className="text-sm font-semibold text-slate-950">Opportunity score</h4>
            <div className="mt-3 flex flex-wrap gap-2">
              {detail.opportunityScore !== undefined && (
                <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  Score {detail.opportunityScore}
                </span>
              )}
              {detail.confidence && (
                <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  Confidence {detail.confidence}
                </span>
              )}
              {detail.risk && (
                <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">Risk {detail.risk}</span>
              )}
              {detail.demand && (
                <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">Demand {detail.demand}</span>
              )}
              {marginLabel && (
                <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{marginLabel}</span>
              )}
            </div>
          </section>

          <details className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4" open>
            <summary className="cursor-pointer text-sm font-semibold text-slate-950">What AMI recommends</summary>
            <dl className="mt-4 flex flex-col gap-3">
              <DrawerField label="Recommended action" value={detail.recommendedAction ?? detail.title} />
              <DrawerField label="Why it matters" value={detail.whyItMatters ?? detail.summary} />
              <DrawerField label="Expected impact" value={detail.expectedImpact} />
              <DrawerField label="Suggested next step" value={detail.suggestedNextStep} />
            </dl>
          </details>

          <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-slate-950">Supplier detail</summary>
            <div className="mt-4">
              <p className="text-sm text-slate-600">Supplier options connected to this analysis</p>
              {detail.suppliers.length > 0 ? (
                <DrawerSupplierTable suppliers={detail.suppliers} />
              ) : (
                <p className="mt-3 text-sm text-slate-600">
                  {SUPPLIER_SOURCE_EMPTY_COPY[detail.supplierSourceStatus]}
                </p>
              )}
            </div>
          </details>

          <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-slate-950">Evidence layer</summary>
            <div className="mt-4">
              {detail.evidence ? (
                <>
                  <div className="mb-3">
                    <BrightDataPill />
                  </div>
                  <div className="mb-4 rounded-lg border border-slate-200 bg-white p-3">
                    <EvidenceLinksPanel
                      links={detail.evidenceLinks}
                      unavailableReason={detail.sourceUrlUnavailableReason}
                      rawRef={detail.evidence.rawRef}
                    />
                  </div>
                  <dl className="flex flex-col gap-2">
                    <DrawerField label="Source marketplace" value={detail.evidence.sourceMarketplace} />
                    <DrawerField label="Source mode" value={formatMode(detail.evidence.brightDataMode)} />
                    <DrawerField label="Bright Data product" value={detail.evidence.brightDataProduct} />
                    <DrawerField label="Current price" value={formatNullableMoney(detail.evidence.currentPrice)} />
                    <DrawerField label="Supplier price" value={formatNullableMoney(detail.evidence.supplierPrice)} />
                    <DrawerField label="Matched attributes" value={detail.evidence.matchedAttributes.join(", ")} />
                    <DrawerField label="Demand indicators" value={detail.evidence.demandIndicators.join(", ")} />
                    <DrawerField label="Risk inputs" value={detail.evidence.riskInputs.join(", ")} />
                    <DrawerField label="Evidence package ID" value={detail.evidence.evidencePackageId} />
                  </dl>
                </>
              ) : (
                <p className="text-sm text-slate-600">No evidence detail is available for this item yet.</p>
              )}
            </div>
          </details>
        </div>
      </aside>
    </div>
  );
}

function DrawerField({ label, value }: { label: string; value?: string }) {
  if (!value) {
    return null;
  }

  const displayValue = safeDisplay(value);

  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm leading-6 text-slate-800">{displayValue}</dd>
    </div>
  );
}

function DrawerSupplierTable({
  suppliers,
  catalogMatchCounts
}: {
  suppliers: SupplierOption[];
  catalogMatchCounts?: Record<string, number>;
}) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-0 text-left text-xs">
        <thead>
          <tr className="uppercase text-slate-500">
            {["Supplier", "Source", "Catalog Matches", "Delivery", "Availability", "Match", "Risk"].map((header) => (
              <th key={header} className="border-b border-slate-200 px-2 py-2 font-semibold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {suppliers.map((supplier, index) => {
            const supplierId = getSupplierRowId(supplier, index);
            const catalogCount = catalogMatchCounts?.[supplierId];
            const catalogDisplay = catalogCount !== undefined ? String(catalogCount) : "—";
            const matchLabel = supplier.matchConfidence
              ? supplier.matchConfidence.charAt(0).toUpperCase() + supplier.matchConfidence.slice(1)
              : "—";

            return (
              <tr key={`${supplier.externalId ?? supplier.rawSourceSnapshotId ?? supplier.supplierName}-${supplier.source}`}>
                <td className="border-b border-slate-100 px-2 py-2 font-semibold text-slate-950">{supplier.supplierName}</td>
                <td className="border-b border-slate-100 px-2 py-2 text-slate-700">{supplier.source}</td>
                <td className="border-b border-slate-100 px-2 py-2 text-slate-700">{catalogDisplay}</td>
                <td className="border-b border-slate-100 px-2 py-2 text-slate-700">{supplier.estimatedDeliveryTime}</td>
                <td className="border-b border-slate-100 px-2 py-2 text-slate-700">{supplier.availability}</td>
                <td className="border-b border-slate-100 px-2 py-2 text-slate-700">{matchLabel}</td>
                <td className="border-b border-slate-100 px-2 py-2 capitalize text-slate-700">{supplier.risk}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function LimitedDataState({ message, detail }: { message: string; detail?: string }) {
  return (
    <div className="py-3">
      <p className="text-sm font-semibold text-slate-950">{message}</p>
      {detail && <p className="mt-1 text-sm leading-6 text-slate-600">{detail}</p>}
    </div>
  );
}

function TabHeader({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}

function SupplierComparisonTable({
  suppliers,
  selectedSupplierIds,
  catalogMatchCounts,
  onToggleSupplier,
  onSeeDetails
}: {
  suppliers: SupplierOption[];
  selectedSupplierIds: Set<string>;
  catalogMatchCounts: Record<string, number>;
  onToggleSupplier: (supplierId: string, checked: boolean) => void;
  onSeeDetails: (supplier: SupplierOption, supplierId: string) => void;
}) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
        <thead>
          <tr className="text-xs uppercase text-slate-500">
            {["Supplier", "Source", "Catalog Matches", "Match", "Delivery batch", "Risk", "Action"].map((header) => (
              <th key={header} className="border-b border-slate-200 px-3 py-2 font-semibold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {suppliers.map((supplier, index) => {
            const supplierId = getSupplierRowId(supplier, index);
            const catalogCount = catalogMatchCounts[supplierId];
            const catalogDisplay = catalogCount !== undefined ? String(catalogCount) : "—";
            const matchLabel = supplier.matchConfidence
              ? supplier.matchConfidence.charAt(0).toUpperCase() + supplier.matchConfidence.slice(1)
              : "—";

            return (
              <tr key={supplierId}>
                <td className="border-b border-slate-100 px-3 py-3">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedSupplierIds.has(supplierId)}
                      onChange={(event) => onToggleSupplier(supplierId, event.target.checked)}
                      aria-label={`Select ${supplier.supplierName}`}
                      className="mt-0.5 size-4 shrink-0 rounded border-slate-300 text-teal-600 focus:ring-teal-600"
                    />
                    <span className="font-semibold text-slate-950">{supplier.supplierName}</span>
                  </div>
                </td>
                <td className="border-b border-slate-100 px-3 py-3 text-slate-700">{supplier.source}</td>
                <td className="border-b border-slate-100 px-3 py-3 text-slate-700">{catalogDisplay}</td>
                <td className="border-b border-slate-100 px-3 py-3 text-slate-700">{matchLabel}</td>
                <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                  {formatDeliveryBatch(supplier.estimatedDeliveryTime)}
                </td>
                <td className="border-b border-slate-100 px-3 py-3 text-slate-700">{formatSupplierRisk(supplier.risk)}</td>
                <td className="border-b border-slate-100 px-3 py-3">
                  <button
                    type="button"
                    onClick={() => onSeeDetails(supplier, supplierId)}
                    className="text-xs font-semibold text-teal-700 hover:text-teal-900"
                  >
                    See details
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SupplierCandidateProductsTable({ rows }: { rows: SupplierCandidateProductRow[] }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
        <thead>
          <tr className="text-xs uppercase text-slate-500">
            {["Product", "Delivery", "Match quality"].map((header) => (
              <th key={header} className="border-b border-slate-200 px-2 py-2 font-semibold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.productName}-${index}`}>
              <td className="border-b border-slate-100 px-2 py-2 font-medium text-slate-950">{row.productName}</td>
              <td className="border-b border-slate-100 px-2 py-2 text-slate-700">{row.delivery}</td>
              <td className="border-b border-slate-100 px-2 py-2 capitalize text-slate-700">{row.matchQuality}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SupplierDetailDrawer({
  detail,
  isSelected,
  productRows,
  selectedProductIds,
  analysis,
  onClose
}: {
  detail: SupplierDrawerDetail;
  isSelected: boolean;
  productRows: PreviewRowData[];
  selectedProductIds: Set<string>;
  analysis: AnalysisResult;
  onClose: () => void;
}) {
  useDrawerLock(onClose);

  const { supplier } = detail;
  const candidateRows = getDrawerCandidateProductRows(productRows, selectedProductIds, supplier, analysis);
  const deliveryCostCopy = resolveSupplierDeliveryCost(analysis, supplier);
  const riskNotes =
    detail.riskInputs && detail.riskInputs.length > 0
      ? detail.riskInputs.join(", ")
      : undefined;

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" className="absolute inset-0 bg-slate-950/40" aria-label="Close drawer" onClick={onClose} />
      <aside
        className="absolute inset-0 flex flex-col bg-white md:inset-y-0 md:left-auto md:right-0 md:w-full md:max-w-lg md:border-l md:border-slate-200 md:shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="supplier-drawer-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 md:px-6">
          <div className="min-w-0">
            <h3 id="supplier-drawer-title" className="text-lg font-semibold text-slate-950">
              Supplier detail
            </h3>
            <p className="mt-1 text-sm font-semibold text-slate-800">{supplier.supplierName}</p>
            <p className="mt-1 text-xs font-semibold uppercase text-slate-500">{isSelected ? "Selected" : "Not selected"}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 p-2 text-slate-700 hover:border-slate-300 hover:text-slate-950"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5 md:px-6">
          <section>
            <h4 className="text-sm font-semibold text-slate-950">Supplier summary</h4>
            <dl className="mt-3 flex flex-col gap-2">
              <DrawerField label="Supplier name" value={supplier.supplierName} />
              <DrawerField label="Source" value={supplier.source} />
              <DrawerField label="Match level" value={supplier.matchConfidence} />
              <DrawerField label="Risk level" value={formatSupplierRisk(supplier.risk)} />
            </dl>
          </section>

          <section className="mt-6 border-t border-slate-100 pt-5">
            <h4 className="text-sm font-semibold text-slate-950">Cost and delivery</h4>
            <dl className="mt-3 flex flex-col gap-2">
              <DrawerField
                label="Unit cost"
                value={formatSupplierCost(supplier.estimatedUnitCost)}
              />
              <DrawerField label="Delivery estimate" value={formatDeliveryBatch(supplier.estimatedDeliveryTime)} />
              <DrawerField label="Supplier price" value={formatSupplierCost(detail.supplierPrice)} />
            </dl>
          </section>

          <section className="mt-6 border-t border-slate-100 pt-5">
            <h4 className="text-sm font-semibold text-slate-950">Candidate Products — {candidateRows.length}</h4>
            {candidateRows.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">
                No candidate products are available for this supplier context yet.
              </p>
            ) : (
              <>
                <SupplierCandidateProductsTable rows={candidateRows} />
                <p className="mt-3 text-xs leading-5 text-slate-600">
                  Unit cost and delivery are based on available supplier-level estimates and should be confirmed per
                  product before purchase.
                </p>
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase text-slate-500">Delivery cost</p>
                  <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{deliveryCostCopy}</p>
                </div>
              </>
            )}
          </section>

          <section className="mt-6 border-t border-slate-100 pt-5">
            <h4 className="text-sm font-semibold text-slate-950">Availability and quality</h4>
            <dl className="mt-3 flex flex-col gap-2">
              <DrawerField label="Availability" value={supplier.availability} />
              <DrawerField label="Quality proxy" value={supplier.ratingQualityProxy} />
            </dl>
          </section>

          <section className="mt-6 border-t border-slate-100 pt-5">
            <h4 className="text-sm font-semibold text-slate-950">Source and Bright Data context</h4>
            <dl className="mt-3 flex flex-col gap-2">
              <DrawerField label="Source mode" value={detail.sourceMode} />
              <DrawerField label="Marketplace" value={detail.marketplace} />
              {detail.brightDataProduct && (
                <>
                  <div className="pt-1">
                    <BrightDataPill />
                  </div>
                  <DrawerField label="Bright Data product" value={detail.brightDataProduct} />
                  <DrawerField label="Bright Data mode" value={detail.brightDataMode} />
                </>
              )}
            </dl>
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <EvidenceLinksPanel
                links={detail.evidenceLinks}
                unavailableReason={detail.sourceUrlUnavailableReason}
                rawRef={detail.rawRef}
              />
            </div>
          </section>

          <section className="mt-6 border-t border-slate-100 pt-5">
            <h4 className="text-sm font-semibold text-slate-950">Risk notes</h4>
            {riskNotes ? (
              <dl className="mt-3 flex flex-col gap-2">
                <DrawerField label="Risk level" value={formatSupplierRisk(supplier.risk)} />
                <DrawerField label="Risk inputs" value={riskNotes} />
              </dl>
            ) : (
              <p className="mt-3 text-sm text-slate-600">No additional supplier risk notes are available yet.</p>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}

function Comparison({ label, value }: { label: string; value: string }) {
  const displayValue = safeDisplay(value);

  return (
    <div className="min-w-56 flex-1 rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-2 break-words text-sm font-semibold text-slate-900">{displayValue}</p>
    </div>
  );
}
