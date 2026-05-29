"use client";

import { useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  FileSearch,
  ShieldAlert,
  X
} from "lucide-react";
import { PageShell, Section, Surface } from "@/components/layout/PagePrimitives";
import { BrightDataPill } from "@/components/ui/BrightDataPill";
import { Badge } from "@/components/ui/Badge";
import { resolveSourceState, sanitizeEvidenceSnippet } from "@/lib/analysis/source-state";
import type { AnalysisResult, EvidencePackage, SourceMode, SupplierOption } from "@/lib/schemas/ami";
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
    return "Live Bright Data data";
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
    return "Fallback snapshot";
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
  evidence?: EvidencePackage;
};

type SupplierDrawerDetail = {
  supplierId: string;
  supplier: SupplierOption;
  sourceMode: string;
  marketplace?: string;
  supplierPrice?: number;
  brightDataProduct?: string;
  brightDataMode?: string;
  riskInputs?: string[];
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

function deriveProductCandidates(analysis: AnalysisResult): PreviewRowData[] {
  const productName = analysis.marketContext.productName;

  return analysis.opportunities.map((opportunity) => ({
    id: `product-${opportunity.recommendationId}`,
    title: productName,
    summary: opportunity.primaryReason,
    risk: opportunity.riskLevel,
    confidence: opportunity.confidenceLevel,
    meta: formatMargin(opportunity.estimatedMargin),
    variant: "product"
  }));
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
    evidence: defaultEvidence
  };

  if (row.id.startsWith("product-")) {
    const recommendationId = row.id.replace("product-", "");
    const opportunity = analysis.opportunities.find((item) => item.recommendationId === recommendationId);
    const evidence = opportunity
      ? analysis.evidencePackages.find((item) => item.evidencePackageId === opportunity.evidencePackageId)
      : defaultEvidence;

    return {
      ...base,
      title: productName,
      opportunityScore: opportunity?.opportunityScore,
      demand: opportunity?.demandSignal,
      estimatedMargin: opportunity?.estimatedMargin,
      recommendedAction: opportunity?.recommendedAction,
      suggestedNextStep: opportunity?.suggestedNextStep,
      whyItMatters: opportunity?.primaryReason ?? row.summary,
      expectedImpact: opportunity ? `${opportunity.matchQuality} match · ${opportunity.signalStrength} signal` : undefined,
      evidence
    };
  }

  if (row.id.startsWith("promo-")) {
    const innerId = row.id.replace("promo-", "");
    const opportunity = analysis.opportunities.find((item) => item.recommendationId === innerId);

    if (opportunity) {
      const evidence = analysis.evidencePackages.find((item) => item.evidencePackageId === opportunity.evidencePackageId);

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
        evidence
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
  if (evidence?.supplierPrice !== undefined) {
    return `$${evidence.supplierPrice.toFixed(2)}`;
  }

  return `$${supplier.estimatedUnitCost.toFixed(2)}`;
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

  return visibleRows.map((row) => {
    const recommendationId = row.id.replace(/^product-/, "");
    const opportunity = analysis.opportunities.find((item) => item.recommendationId === recommendationId);
    const evidence = opportunity
      ? analysis.evidencePackages.find((item) => item.evidencePackageId === opportunity.evidencePackageId)
      : undefined;

    return {
      productName: row.title,
      unitCost: formatCandidateUnitCost(evidence, supplier),
      delivery: formatDeliveryBatch(supplier.estimatedDeliveryTime),
      matchQuality: resolveCandidateMatchQuality(opportunity, evidence)
    };
  });
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
  const evidence = analysis.evidencePackages[0];

  return {
    supplierId,
    supplier,
    sourceMode: formatMode(analysis.sourceCollectionStatus.mode),
    marketplace: analysis.marketContext.targetMarketplace,
    supplierPrice: evidence?.supplierPrice,
    brightDataProduct: evidence?.brightDataProduct,
    brightDataMode: evidence ? formatMode(evidence.brightDataMode) : undefined,
    riskInputs: evidence?.riskInputs
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

  return [
    {
      supplierName: "Verified supplier catalog option",
      source: analysis.marketContext.supplierSource,
      estimatedUnitCost: evidence?.supplierPrice ?? 0,
      estimatedDeliveryTime: "Validation required",
      availability: "Supplier validation pending",
      ratingQualityProxy: "Quality proxy pending",
      matchConfidence: evidence?.matchQuality ?? "medium",
      risk: "medium"
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
      const params = new URLSearchParams(window.location.search);
      const runId = params.get("runId");
      const cached = window.localStorage.getItem("ami.latestAnalysis");

      if (runId) {
        const response = await fetch(`/api/analysis/${runId}`);

        if (response.ok) {
          const result = (await response.json()) as AnalysisResult;
          setAnalysis(result);
          setSelectedId(result.executiveRecommendation.recommendationId);
          return;
        }
      }

      if (cached) {
        const result = JSON.parse(cached) as AnalysisResult;
        setAnalysis(result);
        setSelectedId(result.executiveRecommendation.recommendationId);
        return;
      }

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

  if (!analysis || !selected) {
    return null;
  }

  const sourceState = sourceStateForAnalysis(analysis);
  const evidence = analysis.evidencePackages.find((item) => item.evidencePackageId === selected.evidencePackageId);
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
  const promoCandidateCount = analysis.assistantFindings.filter(
    (finding) => (finding.assistantId === "trend" || finding.assistantId === "competitor") && finding.signal !== "weak"
  ).length;
  const inventoryActionCount = analysis.assistantFindings.filter(
    (finding) => finding.assistantId === "inventory" && analysis.assistantStatus?.inventory !== "skipped"
  ).length;

  return (
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
              onClick={() => {
                if (selectedProductIds.size + selectedPromoIds.size + selectedInventoryIds.size + selectedSupplierIds.size > 0) {
                  setExportPlaceholderMessage("Report export is not connected yet.");
                }
              }}
              disabled={selectedProductIds.size + selectedPromoIds.size + selectedInventoryIds.size + selectedSupplierIds.size === 0}
              className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Export AMI Report
            </button>
            {exportPlaceholderMessage ? (
              <p className="text-xs leading-5 text-slate-600">{exportPlaceholderMessage}</p>
            ) : null}
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

  const productRows = useMemo(() => deriveProductCandidates(analysis), [analysis]);
  const promoRows = useMemo(
    () => derivePromoCandidates(analysis).map((row) => ({ ...row, id: `promo-${row.id}` })),
    [analysis]
  );
  const inventoryRows = useMemo(
    () => deriveInventoryActions(analysis, selected).map((row) => ({ ...row, id: `inventory-${row.id}` })),
    [analysis, selected]
  );
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
              productCandidateCount={productRows.length}
              selectedProductCount={selectedProductIds.size}
              selectedSupplierIds={selectedSupplierIds}
              onToggleSupplier={handleSupplierToggle}
              onSeeDetails={(supplier, supplierId) =>
                setSupplierDrawer(resolveSupplierDrawerDetail(supplier, analysis, supplierId))
              }
            />
          ) : (
            <p className="mt-4 text-sm text-slate-600">Supplier options connected to this analysis will appear here when available.</p>
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

      <details className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4" open>
        <summary className="flex items-center justify-between text-sm font-semibold text-slate-950">
          Source evidence
          <FileSearch size={18} />
        </summary>
        {evidence ? (
          <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-700">
            <Comparison label="Product identity" value={evidence.productIdentity} />
            <Comparison label="Source marketplace" value={evidence.sourceMarketplace} />
            <Comparison label="Source mode" value={formatMode(evidence.brightDataMode)} />
            <Comparison label="Bright Data product" value={evidence.brightDataProduct} />
            <Comparison label="Current price" value={`$${evidence.currentPrice.toFixed(2)}`} />
            <Comparison label="Supplier price" value={`$${evidence.supplierPrice.toFixed(2)}`} />
            <Comparison label="Matched attributes" value={evidence.matchedAttributes.join(", ")} />
            <Comparison label="Demand indicators" value={evidence.demandIndicators.join(", ")} />
            <Comparison label="Risk inputs" value={evidence.riskInputs.join(", ")} />
            <Comparison label="Evidence package" value={evidence.evidencePackageId} />
          </div>
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
    detail.estimatedMargin !== undefined && detail.estimatedMargin > 0
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
                <p className="mt-3 text-sm text-slate-600">No supplier detail is available for this item yet.</p>
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
                  <dl className="flex flex-col gap-2">
                    <DrawerField label="Source marketplace" value={detail.evidence.sourceMarketplace} />
                    <DrawerField label="Source mode" value={formatMode(detail.evidence.brightDataMode)} />
                    <DrawerField label="Bright Data product" value={detail.evidence.brightDataProduct} />
                    <DrawerField label="Current price" value={`$${detail.evidence.currentPrice.toFixed(2)}`} />
                    <DrawerField label="Supplier price" value={`$${detail.evidence.supplierPrice.toFixed(2)}`} />
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

function DrawerSupplierTable({ suppliers }: { suppliers: SupplierOption[] }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-0 text-left text-xs">
        <thead>
          <tr className="uppercase text-slate-500">
            {["Supplier", "Source", "Unit cost", "Delivery", "Availability", "Match", "Risk"].map((header) => (
              <th key={header} className="border-b border-slate-200 px-2 py-2 font-semibold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {suppliers.map((supplier) => (
            <tr key={`${supplier.supplierName}-${supplier.source}`}>
              <td className="border-b border-slate-100 px-2 py-2 font-semibold text-slate-950">{supplier.supplierName}</td>
              <td className="border-b border-slate-100 px-2 py-2 text-slate-700">{supplier.source}</td>
              <td className="border-b border-slate-100 px-2 py-2 text-slate-700">${supplier.estimatedUnitCost.toFixed(2)}</td>
              <td className="border-b border-slate-100 px-2 py-2 text-slate-700">{supplier.estimatedDeliveryTime}</td>
              <td className="border-b border-slate-100 px-2 py-2 text-slate-700">{supplier.availability}</td>
              <td className="border-b border-slate-100 px-2 py-2 capitalize text-slate-700">{supplier.matchConfidence}</td>
              <td className="border-b border-slate-100 px-2 py-2 capitalize text-slate-700">{supplier.risk}</td>
            </tr>
          ))}
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
  productCandidateCount,
  selectedProductCount,
  selectedSupplierIds,
  onToggleSupplier,
  onSeeDetails
}: {
  suppliers: SupplierOption[];
  productCandidateCount: number;
  selectedProductCount: number;
  selectedSupplierIds: Set<string>;
  onToggleSupplier: (supplierId: string, checked: boolean) => void;
  onSeeDetails: (supplier: SupplierOption, supplierId: string) => void;
}) {
  const itemsCovered = formatItemsCovered(productCandidateCount, selectedProductCount);

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
        <thead>
          <tr className="text-xs uppercase text-slate-500">
            {["Supplier", "Source", "Items covered", "Delivery batch", "Risk", "Action"].map((header) => (
              <th key={header} className="border-b border-slate-200 px-3 py-2 font-semibold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {suppliers.map((supplier, index) => {
            const supplierId = getSupplierRowId(supplier, index);

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
                <td className="border-b border-slate-100 px-3 py-3 text-slate-700">{itemsCovered}</td>
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
            {["Product", "Unit cost", "Delivery", "Match quality"].map((header) => (
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
              <td className="border-b border-slate-100 px-2 py-2 text-slate-700">{row.unitCost}</td>
              <td className="border-b border-slate-100 px-2 py-2 text-slate-700">{row.delivery}</td>
              <td className="border-b border-slate-100 px-2 py-2 text-slate-700">{row.matchQuality}</td>
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
              <DrawerField label="Unit cost" value={`$${supplier.estimatedUnitCost.toFixed(2)}`} />
              <DrawerField label="Delivery estimate" value={formatDeliveryBatch(supplier.estimatedDeliveryTime)} />
              {detail.supplierPrice !== undefined && (
                <DrawerField label="Supplier price" value={`$${detail.supplierPrice.toFixed(2)}`} />
              )}
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
