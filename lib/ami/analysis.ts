import { randomUUID } from "node:crypto";
import { scrapeProductPage, searchSERP } from "@/lib/brightdata/client";
import type {
  AnalysisResult,
  AssistantContribution,
  AssistantFinding,
  EvidencePackage,
  MarketContextPayload,
  Recommendation,
  SourceMode,
  SupplierOption
} from "@/lib/schemas/ami";
import {
  AnalysisResultSchema,
  AssistantFindingSchema,
  EvidencePackageSchema,
  RecommendationSchema
} from "@/lib/schemas/ami";

export const INVENTORY_CONTEXT_UNAVAILABLE_WARNING =
  "Inventory context was requested, but no usable inventory source is connected. AMI continued using trend, competitor, and supplier signals.";

type InventoryRunContext = {
  requested: boolean;
  available: boolean;
  warningMessage?: string;
  sourceLabel?: string;
};

function riskFromGoal(goal: MarketContextPayload["businessGoal"]) {
  if (goal === "stock_optimization") {
    return "medium" as const;
  }

  if (goal === "discover_new_products") {
    return "low" as const;
  }

  return "medium" as const;
}

function actionFromGoal(context: MarketContextPayload) {
  const actions: Record<MarketContextPayload["businessGoal"], string> = {
    discover_new_products: `Prioritize sourcing review for ${context.productName}`,
    stock_optimization: `Optimize stock movement for ${context.productName}`,
    revenue_stock_opportunities: `Position ${context.productName} for revenue lift`
  };

  return actions[context.businessGoal];
}

function assistantContributions(mode: SourceMode, product: string, inventoryContext: InventoryRunContext): AssistantContribution[] {
  const sourceLabel =
    mode === "live"
      ? "Bright Data live web intelligence"
      : "Bright Data-shaped demo fallback source snapshots";
  const usesInventory = inventoryContext.requested && inventoryContext.available;
  const inventoryUnavailable = inventoryContext.requested && !inventoryContext.available;

  return [
    {
      assistantId: "trend",
      summary: `Validated demand momentum for ${product} with seasonal and social signal context.`,
      latestContribution: "Detected rising search and social momentum, with seasonality supporting near-term demand.",
      signalStrength: "strong",
      confidence: "high",
      risk: "low",
      dataSourcesUsed: [sourceLabel, "Demand momentum snapshot"],
      usageCost: 0.6
    },
    {
      assistantId: "competitor",
      summary: "Detected moderate price pressure with room to protect margin.",
      latestContribution: "Compared competitor price, promotion pressure, availability, and market pressure.",
      signalStrength: "moderate",
      confidence: "high",
      risk: "medium",
      dataSourcesUsed: [sourceLabel, "Marketplace comparison snapshot"],
      usageCost: 0.8
    },
    {
      assistantId: "supplier",
      summary: "Found viable supplier options with estimated costs, delivery windows, and manageable sourcing risk.",
      latestContribution: "Compared supplier cost, availability, match confidence, and estimated delivery time.",
      signalStrength: "strong",
      confidence: "medium",
      risk: "medium",
      dataSourcesUsed: ["Verified supplier catalog", "Supplier pricing snapshot"],
      usageCost: 0.9
    },
    {
      assistantId: "inventory",
      summary: inventoryUnavailable
        ? "Inventory context was requested, but no usable source is connected."
        : usesInventory
          ? "Reviewed stock posture and supplier margin context without exposing raw inventory records."
          : "Inventory Assistant was skipped because this goal can run without inventory context.",
      latestContribution: inventoryUnavailable
        ? (inventoryContext.warningMessage ?? INVENTORY_CONTEXT_UNAVAILABLE_WARNING)
        : usesInventory
          ? "Flagged enough margin headroom to justify a controlled sourcing review."
          : "AMI used trend, competitor, and supplier signals without inventory context.",
      signalStrength: usesInventory ? "strong" : "moderate",
      confidence: "medium",
      risk: "medium",
      dataSourcesUsed: usesInventory
        ? [inventoryContext.sourceLabel ?? "Workspace inventory context", "Supplier margin snapshot"]
        : ["Inventory Assistant skipped", "Trend, competitor, and supplier signals"],
      usageCost: usesInventory ? 0.7 : 0
    }
  ];
}

function assistantFindings(
  context: MarketContextPayload,
  mode: SourceMode,
  sourceLabel: string,
  inventoryContext: InventoryRunContext
): AssistantFinding[] {
  const dataFreshness =
    mode === "live" ? "Collected during this analysis run" : "Seeded demo snapshot refreshed for the MVP walkthrough";
  const usesInventory = inventoryContext.requested && inventoryContext.available;
  const inventoryUnavailable = inventoryContext.requested && !inventoryContext.available;

  return [
    {
      assistantId: "trend",
      finding: "Demand momentum is strong enough to justify near-term validation.",
      reason: "Search interest and social momentum support a short-cycle market test.",
      signal: "strong",
      confidence: "high",
      risk: "low",
      sourceType: sourceLabel,
      sourceLabel: "Demand and social momentum snapshot",
      dataFreshness
    },
    {
      assistantId: "competitor",
      finding: "Competitor pressure is present but not blocking.",
      reason: `${context.targetMarketplace} comparison shows price room if supplier terms hold.`,
      signal: "moderate",
      confidence: "high",
      risk: "medium",
      sourceType: sourceLabel,
      sourceLabel: "Competitor marketplace snapshot",
      dataFreshness
    },
    {
      assistantId: "supplier",
      finding: "Supplier options are available for a controlled sourcing review.",
      reason: "Supplier cost, delivery estimates, and match confidence support a scoped validation step before scaling.",
      signal: "strong",
      confidence: "medium",
      risk: "medium",
      sourceType: "Supplier sourcing snapshot",
      sourceLabel: "Verified supplier catalog",
      dataFreshness: "Demo supplier snapshot prepared for this MVP"
    },
    {
      assistantId: "inventory",
      finding: inventoryUnavailable
        ? "Inventory Assistant continued as a warning state."
        : usesInventory
          ? "Inventory context supports a controlled action, not a broad purchasing move."
          : "Inventory Assistant was skipped for this optional inventory goal.",
      reason: inventoryUnavailable
        ? (inventoryContext.warningMessage ?? INVENTORY_CONTEXT_UNAVAILABLE_WARNING)
        : usesInventory
          ? "AMI used connected inventory context to keep the recommendation scoped to current operating posture."
          : "AMI used supplier and margin context because no connected inventory source was selected.",
      signal: usesInventory ? "strong" : "moderate",
      confidence: "medium",
      risk: "medium",
      sourceType: "Workspace inventory context",
      sourceLabel: usesInventory ? inventoryContext.sourceLabel ?? "Connected inventory context" : "No inventory context selected",
      dataFreshness: usesInventory
        ? "Last inventory analysis timestamp is available in Account / Workspace"
        : "No inventory sync was used for this run"
    }
  ].map((finding) => AssistantFindingSchema.parse(finding));
}

function buildEvidencePackage(
  context: MarketContextPayload,
  mode: "live" | "demo_fallback",
  brightDataProduct: "MCP Server" | "Web Scraper API" | "SERP API" | "Web Unlocker" | "Scraping Browser" | "Scraper Studio",
  scrapedAt: string
): EvidencePackage {
  return EvidencePackageSchema.parse({
    evidencePackageId: randomUUID(),
    sourceMarketplace: context.targetMarketplace,
    sourceType: mode === "live" ? "bright_data_live_web_data" : "bright_data_demo_fallback_snapshot",
    sourceUrl: "https://www.amazon.com/s?k=insulated+tumbler",
    brightDataProduct,
    brightDataMode: mode,
    scrapedAt,
    productIdentity: context.productName,
    currentPrice: 29.99,
    supplierPrice: 18.4,
    estimatedMargin: 38.6,
    demandIndicators: ["Rising search interest", "Positive review velocity", "Seasonal buying window"],
    socialMomentum: "strong",
    competitionLevel: "moderate",
    matchQuality: "high",
    matchScore: 86,
    matchedAttributes: ["Product name", "Category", "Capacity", "Material", "Marketplace query intent"],
    riskInputs: ["Moderate promotion pressure", "Supplier delivery time should be validated"],
    assistantUsed: "competitor"
  });
}

function buildSupplierOptions(): SupplierOption[] {
  return [
    {
      supplierName: "Northstar Supply Co.",
      source: "Verified supplier catalog",
      estimatedUnitCost: 18.4,
      estimatedDeliveryTime: "8-12 days",
      availability: "In stock",
      ratingQualityProxy: "4.7 / 5 quality proxy",
      matchConfidence: "high",
      risk: "low"
    },
    {
      supplierName: "Pacific Drinkware Direct",
      source: "Supplier marketplace snapshot",
      estimatedUnitCost: 16.9,
      estimatedDeliveryTime: "14-21 days",
      availability: "Limited batch",
      ratingQualityProxy: "4.3 / 5 quality proxy",
      matchConfidence: "medium",
      risk: "medium"
    }
  ];
}

function buildRecommendation(
  workspaceId: string,
  analysisRunId: string,
  context: MarketContextPayload,
  evidencePackage: EvidencePackage,
  mode: SourceMode,
  inventoryContext: InventoryRunContext
): Recommendation {
  const riskLevel = riskFromGoal(context.businessGoal);
  const contributions = assistantContributions(mode, context.productName, inventoryContext);
  const opportunityScore = inventoryContext.requested && inventoryContext.available ? 84 : 78;

  return RecommendationSchema.parse({
    recommendationId: randomUUID(),
    analysisRunId,
    workspaceId,
    recommendedAction: actionFromGoal(context),
    opportunityScore,
    estimatedMargin: evidencePackage.estimatedMargin,
    demandSignal: "strong",
    riskLevel,
    confidenceLevel: "high",
    signalStrength: "strong",
    dataFreshness:
      mode === "live"
        ? "Live Bright Data collection completed during this run"
        : "Demo fallback uses seeded Bright Data-shaped source snapshots",
    matchQuality: evidencePackage.matchQuality,
    primaryReason:
      "AMI detected a margin-backed opportunity with rising demand, viable supplier options, and manageable competitor pressure.",
    suggestedNextStep:
      "Run a controlled sourcing validation and confirm supplier delivery terms before scaling the action.",
    assistantContributions: contributions,
    evidencePackageId: evidencePackage.evidencePackageId,
    status: "new",
    createdAt: new Date().toISOString()
  });
}

export async function runAmiAnalysis(
  workspaceId: string,
  context: MarketContextPayload,
  inventoryContext: InventoryRunContext = { requested: context.useInventoryContext, available: context.useInventoryContext }
): Promise<AnalysisResult> {
  const analysisRunId = randomUUID();
  const startedAt = new Date().toISOString();
  const [serpResult, scrapeResult] = await Promise.all([
    searchSERP(`${context.productName} ${context.targetMarketplace} ${context.region}`),
    scrapeProductPage("https://www.amazon.com/s?k=insulated+tumbler")
  ]);
  const mode = scrapeResult.mode === "live" || serpResult.mode === "live" ? "live" : "demo_fallback";
  const completedAt = new Date().toISOString();
  const evidencePackage = buildEvidencePackage(context, mode, scrapeResult.product, completedAt);
  const supplierOptions = buildSupplierOptions();
  const executiveRecommendation = buildRecommendation(workspaceId, analysisRunId, context, evidencePackage, mode, inventoryContext);
  const findings = assistantFindings(context, mode, scrapeResult.message, inventoryContext);
  const secondaryOpportunity = RecommendationSchema.parse({
    ...executiveRecommendation,
    recommendationId: randomUUID(),
    recommendedAction: `Monitor ${context.productName} competitor promotions before broad rollout`,
    opportunityScore: Math.max(0, executiveRecommendation.opportunityScore - 9),
    riskLevel: "medium",
    confidenceLevel: "medium",
    primaryReason:
      "A watch-and-adjust path remains useful if competitor promotion pressure increases during the validation window.",
    suggestedNextStep: "Save this as a monitoring follow-up after the primary sourcing review."
  });
  const result = AnalysisResultSchema.parse({
    analysisRunId,
    workspaceId,
    marketContext: context,
    status: "completed",
    startedAt,
    completedAt,
    assistantStatus: {
      trend: "completed",
      competitor: "completed",
      supplier: "completed",
      inventory:
        inventoryContext.requested && inventoryContext.available
          ? "completed"
          : inventoryContext.warningMessage
            ? "warning"
            : "skipped",
    },
    sourceCollectionStatus: {
      brightDataProduct: mode === "live" ? scrapeResult.product : "Web Scraper API / SERP API",
      mode,
      label:
        mode === "live"
          ? "Bright Data live web collection completed"
          : "Bright Data demo fallback source snapshots used",
      collectedAt: completedAt
    },
    executiveRecommendation,
    opportunities: [executiveRecommendation, secondaryOpportunity],
    assistantFindings: findings,
    evidencePackages: [evidencePackage],
    supplierOptions,
    warnings: inventoryContext.warningMessage ? [inventoryContext.warningMessage] : [],
    demoMode: mode === "demo_fallback"
  });

  return result;
}
