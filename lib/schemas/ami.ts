import { z } from "zod";
import {
  AgentOutputUnion,
  AgentStatusSchema as RuntimeAgentStatusSchema,
  AgentTypeSchema,
  CoordinatorSynthesisOutputSchema,
  EvidenceRefSchema,
  ExternalActionPayloadSchema,
  RiskLevelSchema as RuntimeRiskLevelSchema,
  VerdictAgentOutputSchema
} from "@/lib/schemas/agents";

export const AssistantIdSchema = AgentTypeSchema;
export const RiskLevelSchema = RuntimeRiskLevelSchema;
export const ConfidenceLevelSchema = z.enum(["low", "medium", "high"]);
export const SignalStrengthSchema = z.enum(["weak", "moderate", "strong"]);
export const AnalysisStatusSchema = z.enum([
  "pending",
  "created",
  "collecting_data",
  "normalizing_data",
  "metrics_ready",
  "agents_running",
  "synthesizing",
  "generating_verdict",
  "running",
  "completed",
  "completed_with_fallback",
  "failed",
  "warning",
  "skipped",
  "fallback"
]);
export const NormalizedSourceModeSchema = z.enum(["live", "fallback_snapshot", "demo_seed"]);
export const SourceModeSchema = z.enum([
  "pending",
  "live",
  "demo",
  "fallback",
  "fallback_snapshot",
  "demo_seed",
  "demo_fallback",
  "mixed",
  "error",
  "demo_snapshot",
  "not_configured"
]);
export const SourceProviderSchema = z.enum(["brightdata", "demo", "unknown"]);
export const SourceProviderStatusSchema = z.enum(["pending", "live_success", "fallback_used", "partial_fallback", "failed"]);
export const AnalysisRunModeSchema = z.enum(["live", "demo", "fallback"]);
export const CanonicalSourceModeSchema = z.enum(["live", "demo", "mixed", "fallback"]);
export const RawSourceStatusSchema = z.enum(["success", "partial", "empty", "failed"]);
export const DataQualityStatusSchema = z.enum(["success", "partial", "degraded", "failed"]);
export const EvidenceLinkSchema = z.object({
  label: z.string().min(1),
  url: z.string().url(),
  sourceName: z.string().min(1),
  sourceType: z.enum(["marketplace", "supplier", "trend", "raw_snapshot", "search"]),
  sourceStatus: RawSourceStatusSchema.optional(),
  lastSeenAt: z.string().optional(),
  rawSourceSnapshotId: z.string().optional()
});
export const SourceProofItemSchema = z.object({
  title: z.string().min(1),
  sourceType: z.enum(["brightdata", "provider", "demo_fallback", "manual", "unknown"]),
  sourceMode: z.enum(["live", "fallback_snapshot", "demo_seed", "demo_fallback", "mixed"]),
  sourceUrl: z.string().url().nullable(),
  collectedAt: z.string().min(1),
  snippet: z.string().nullable(),
  isFallback: z.boolean()
});
const SpecialistAssistantSchema = z.enum(["inventory", "trend", "competitor", "supplier"]);
export const SourceSummarySchema = z.object({
  provider: SourceProviderSchema,
  productsUsed: z.array(z.string()).default([]),
  liveAttempted: z.boolean(),
  liveSucceeded: z.boolean(),
  fallbackUsed: z.boolean(),
  rawSnapshotsSaved: z.number().int().nonnegative(),
  rawSnapshotsLoaded: z.number().int().nonnegative(),
  evidenceItemsCreated: z.number().int().nonnegative()
});
export const RawSnapshotMetadataSchema = z.object({
  runId: z.string(),
  sourceProvider: SourceProviderSchema,
  sourceProduct: z.string(),
  sourceType: z.string(),
  sourceName: z.string(),
  rawRef: z.string(),
  capturedAt: z.string(),
  mode: NormalizedSourceModeSchema,
  recordCount: z.number().int().nonnegative().optional(),
  status: z.enum(["success", "partial", "empty", "failed", "loaded_from_snapshot", "not_saved"]).default("success"),
  safeError: z.string().optional()
});
export const RawSourceSnapshotRecordSchema = z.object({
  rawSourceSnapshotId: z.string(),
  analysisRunId: z.string(),
  source: z.string(),
  status: RawSourceStatusSchema,
  sourceUrl: z.string().url().optional(),
  errorCode: z.string().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  input: z.record(z.unknown()).default({}),
  recordCount: z.number().int().nonnegative(),
  receivedAt: z.string(),
  rawPayloadRef: z.string().optional()
});
export const RawSourceSummarySchema = z.object({
  success: z.array(z.string()).default([]),
  partial: z.array(z.string()).default([]),
  empty: z.array(z.string()).default([]),
  failed: z.array(z.string()).default([])
});
export const DataQualitySchema = z.object({
  status: DataQualityStatusSchema,
  failedSources: z.array(z.string()).default([]),
  partialSources: z.array(z.string()).default([]),
  emptySources: z.array(z.string()).default([]),
  fallbacksUsed: z.array(z.string()).default([]),
  missingCriticalFields: z.array(z.string()).default([]),
  confidencePenaltyApplied: z.number().min(0).max(1).default(0),
  sourceReliability: z.number().min(0).max(1).nullable().default(null),
  fieldCompleteness: z.number().min(0).max(1).nullable().default(null),
  sourceFreshness: z.number().min(0).max(1).nullable().default(null),
  matchQuality: z.number().min(0).max(1).nullable().default(null),
  agentAgreement: z.number().min(0).max(1).nullable().default(null)
});
export const AnalysisRunContractSchema = z.object({
  analysisRunId: z.string(),
  workspaceId: z.string(),
  businessGoal: z.string(),
  goalIntent: z.string(),
  inputContext: z.record(z.unknown()).default({}),
  status: AnalysisStatusSchema,
  mode: AnalysisRunModeSchema,
  sourceMode: CanonicalSourceModeSchema,
  startedAt: z.string(),
  completedAt: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});
export const BusinessGoalSchema = z.enum(["discover_new_products", "stock_optimization", "revenue_stock_opportunities"]);
export const EvidenceTraceMetadataSchema = z.object({
  runId: z.string(),
  sourceProvider: SourceProviderSchema,
  sourceProduct: z.string(),
  sourceType: z.string(),
  sourceName: z.string(),
  targetMarketplace: z.string().optional(),
  scraperName: z.string().optional(),
  datasetId: z.string().optional(),
  operation: z.string().optional(),
  snapshotId: z.string().optional(),
  sourceUrl: z.string().url().optional(),
  productUrl: z.string().url().optional(),
  marketplaceUrl: z.string().url().optional(),
  supplierUrl: z.string().url().optional(),
  imageUrl: z.string().url().optional(),
  title: z.string().optional(),
  price: z.number().optional(),
  currency: z.string().optional(),
  rating: z.number().optional(),
  reviewsCount: z.number().optional(),
  availability: z.string().optional(),
  sellerName: z.string().optional(),
  category: z.string().optional(),
  rawSourceSnapshotId: z.string().optional(),
  rawRef: z.string().optional(),
  capturedAt: z.string(),
  lastSeenAt: z.string().optional(),
  mode: NormalizedSourceModeSchema,
  sourceMode: NormalizedSourceModeSchema.optional(),
  extractedFields: z.record(z.unknown()).default({}),
  assistantTypesUsedBy: z.array(SpecialistAssistantSchema).default([]),
  confidence: z.number().min(0).max(1).optional(),
  matchScore: z.number().min(0).max(100).optional()
});
export const AssistantRunTraceSchema = z.object({
  runId: z.string(),
  assistantRunId: z.string(),
  analysisRunId: z.string().optional(),
  agent: AgentTypeSchema.optional(),
  assistantType: AgentTypeSchema,
  businessGoal: BusinessGoalSchema.optional(),
  goalIntent: z.string().optional(),
  status: AnalysisStatusSchema,
  executionOrder: z.number().int().positive().optional(),
  sourcesUsed: z.array(z.string()).default([]),
  inputRefs: z.array(z.string()).default([]),
  outputRef: z.string().optional(),
  missingSignals: z.array(z.string()).default([]),
  fallbackSignals: z.array(z.string()).default([]),
  confidenceAdjustment: z.record(z.unknown()).default({}),
  startedAt: z.string(),
  completedAt: z.string().optional(),
  dataSourcesUsed: z.array(z.string()).default([]),
  evidenceIds: z.array(z.string()).default([]),
  latestContribution: z.string().optional(),
  usageEstimate: z.number().nonnegative().optional(),
  warning: z.string().optional()
});
export const CoordinatorRunTraceSchema = z.object({
  runId: z.string(),
  coordinatorRunId: z.string(),
  coordinatorType: z.literal("ami_orchestrator"),
  status: AnalysisStatusSchema,
  startedAt: z.string(),
  completedAt: z.string().optional(),
  assistantRunIds: z.array(z.string()).default([]),
  evidenceIds: z.array(z.string()).default([]),
  finalRecommendationId: z.string().optional(),
  reasoningSummary: z.string().optional(),
  assistantContributionSummary: z.record(z.string(), z.string()).default({}),
  confidence: z.number().min(0).max(1).optional(),
  riskScore: z.number().min(0).max(100).optional(),
  sourceMode: SourceModeSchema,
  fallbackUsed: z.boolean()
});
export const InventorySourceStatusSchema = z.enum([
  "not_connected",
  "connected",
  "demo_snapshot",
  "warning",
  "syncing",
  "error"
]);

export const VisibleAssistants = [
  {
    id: "orchestrator",
    name: "AMI Orchestrator",
    role: "Builds the goal-specific strategy, resolves conflicts, applies scoring rules, and produces the final recommendation."
  },
  {
    id: "inventory",
    name: "Inventory Assistant",
    role: "Maps internal marketplace context, inventory health, cannibalization, restock need, and operational fit."
  },
  {
    id: "trend",
    name: "Trend Assistant",
    role: "Reads demand signals, market momentum, social direction, and product trend movement."
  },
  {
    id: "competitor",
    name: "Competitor Assistant",
    role: "Tracks competitor pricing, promotions, availability, and market pressure."
  },
  {
    id: "supplier",
    name: "Supplier Assistant",
    role: "Searches for suppliers and evaluates sourcing feasibility, margin potential, delivery windows, and supplier risk."
  }
] as const;

export const BusinessGoals = [
  {
    id: "discover_new_products",
    label: "Discover New Products",
    description:
      "Identifies new product opportunities with low market saturation from demand signals, supplier availability, trends, and competitive gaps."
  },
  {
    id: "stock_optimization",
    label: "Stock Optimization",
    description:
      "Analyzes inventory to identify slow-moving, overstocked, or margin-sensitive products and recommends movement strategies."
  },
  {
    id: "revenue_stock_opportunities",
    label: "Revenue Stock Opportunities",
    description:
      "Compares current inventory against trends, competitor activity, and supplier conditions to maximize margin and sales velocity."
  }
] as const;

const CurrencySchema = z.string().trim().min(3).max(3).transform((value) => value.toUpperCase());

export const RegisterPayloadSchema = z.object({
  user: z.object({
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().email().max(180).transform((value) => value.toLowerCase()),
    password: z.string().min(8).max(120)
  }),
  workspace: z.object({
    workspaceName: z.string().trim().min(2).max(100),
    workspaceType: z.string().trim().min(2).max(80),
    defaultRegion: z.string().trim().min(2).max(80),
    defaultCurrency: CurrencySchema
  }),
  marketplaceProfile: z.object({
    businessName: z.string().trim().min(2).max(120),
    businessType: z.string().trim().min(2).max(80),
    primaryMarketplace: z.string().trim().min(2).max(120),
    mainProductCategory: z.string().trim().min(2).max(120),
    targetRegion: z.string().trim().min(2).max(80),
    defaultCurrency: CurrencySchema
  })
});

export const LoginPayloadSchema = z.object({
  workspaceId: z.string().trim().min(1).max(180),
  password: z.string().min(1).max(120)
});

export const MarketContextPayloadSchema = z.object({
  productName: z.string().trim().min(2).max(140),
  category: z.string().trim().min(2).max(120),
  targetMarketplace: z.string().trim().min(2).max(120),
  supplierSource: z.string().trim().min(2).max(160),
  businessGoal: BusinessGoalSchema,
  region: z.string().trim().min(2).max(80),
  currency: CurrencySchema,
  useInventoryContext: z.boolean().default(false)
});

export const AssistantFindingSchema = z.object({
  assistantId: AssistantIdSchema,
  finding: z.string().min(4),
  reason: z.string().min(4),
  signal: SignalStrengthSchema,
  confidence: ConfidenceLevelSchema,
  risk: RiskLevelSchema,
  sourceType: z.string().min(2),
  sourceLabel: z.string().min(2),
  dataFreshness: z.string().min(2)
});

export const AssistantContributionSchema = z.object({
  assistantId: AssistantIdSchema,
  summary: z.string().min(4),
  latestContribution: z.string().min(4),
  signalStrength: SignalStrengthSchema,
  confidence: ConfidenceLevelSchema,
  risk: RiskLevelSchema,
  dataSourcesUsed: z.array(z.string()).min(1),
  usageCost: z.number().nonnegative()
});

export const EvidencePackageSchema = z.object({
  evidencePackageId: z.string(),
  runId: z.string().optional(),
  sourceMarketplace: z.string(),
  sourceType: z.string(),
  sourceStatus: RawSourceStatusSchema.optional(),
  url: z.string().url().optional(),
  sourceUrl: z.string().url().nullable().optional(),
  sourceProvider: SourceProviderSchema.optional(),
  sourceProduct: z.string().optional(),
  sourceName: z.string().optional(),
  targetMarketplace: z.string().optional(),
  scraperName: z.string().optional(),
  datasetId: z.string().optional(),
  operation: z.string().optional(),
  snapshotId: z.string().optional(),
  productUrl: z.string().url().optional(),
  supplierUrl: z.string().url().optional(),
  marketplaceUrl: z.string().url().optional(),
  imageUrl: z.string().url().optional(),
  title: z.string().optional(),
  price: z.number().optional(),
  currency: z.string().optional(),
  rating: z.number().optional(),
  reviewsCount: z.number().optional(),
  availability: z.string().optional(),
  sellerName: z.string().optional(),
  category: z.string().optional(),
  rawSourceSnapshotId: z.string().optional(),
  rawRef: z.string().optional(),
  capturedAt: z.string().optional(),
  lastSeenAt: z.string().optional(),
  mode: NormalizedSourceModeSchema.optional(),
  extractedFields: z.record(z.unknown()).default({}),
  assistantTypesUsedBy: z.array(SpecialistAssistantSchema).default([]),
  brightDataProduct: z.enum(["MCP Server", "Web Scraper API", "SERP API", "Web Unlocker", "Scraping Browser", "Scraper Studio"]),
  brightDataMode: SourceModeSchema,
  sourceMode: SourceModeSchema.optional(),
  isFallback: z.boolean().default(false),
  scrapedAt: z.string(),
  productIdentity: z.string(),
  currentPrice: z.number().nonnegative().nullable(),
  supplierPrice: z.number().nonnegative().nullable(),
  estimatedMargin: z.number().nullable(),
  demandIndicators: z.array(z.string()),
  socialMomentum: SignalStrengthSchema,
  competitionLevel: z.enum(["low", "moderate", "high"]),
  matchQuality: ConfidenceLevelSchema,
  matchScore: z.number().min(0).max(100),
  matchedAttributes: z.array(z.string()),
  riskInputs: z.array(z.string()),
  assistantUsed: AssistantIdSchema
});

// Real Bright Data marketplace seller candidate (Amazon/eBay). This is genuine
// scraped seller/source data — NOT fabricated and NOT a validated wholesale
// supplier. marketplaceOfferPrice is the seller's listing price, never supplier
// cost; supplierCostValidated is always false here.
export const MarketplaceSellerSchema = z.object({
  sellerName: z.string().min(1),
  sellerUrl: z.string().url().optional(),
  sellerId: z.string().optional(),
  // "amazon_seller_data" | "ebay_marketplace_seller_data"
  source: z.string().min(2),
  marketplaceOfferPrice: z.number().nonnegative().nullable().default(null),
  marketplaceOfferCurrency: z.string().optional(),
  deliveryRaw: z.string().optional(),
  availability: z.string().optional(),
  rating: z.number().min(0).max(5).nullable().default(null),
  isBrightDataSource: z.literal(true).default(true),
  supplierCostValidated: z.literal(false).default(false)
});

export const SupplierOptionSchema = z.object({
  supplierName: z.string().min(2),
  source: z.string().min(2),
  externalId: z.string().optional(),
  evidenceRefIds: z.array(z.string()).default([]),
  sourceUrl: z.string().url().optional(),
  productUrl: z.string().url().optional(),
  supplierUrl: z.string().url().optional(),
  rawSourceSnapshotId: z.string().optional(),
  lastSeenAt: z.string().optional(),
  estimatedUnitCost: z.number().nonnegative().nullable(),
  estimatedDeliveryTime: z.string().min(2),
  availability: z.string().min(2),
  ratingQualityProxy: z.string().min(2),
  matchConfidence: ConfidenceLevelSchema,
  risk: RiskLevelSchema,
  isFallback: z.boolean().default(false),
  // Real Bright Data marketplace seller fields (Amazon/eBay). marketplaceOfferPrice
  // is a seller listing price, NOT supplier cost — estimatedUnitCost stays null and
  // supplierCostValidated stays false unless a true supplier-cost field exists.
  isBrightDataSource: z.boolean().optional(),
  marketplaceOfferPrice: z.number().nonnegative().nullable().optional(),
  marketplaceOfferCurrency: z.string().optional(),
  deliveryRaw: z.string().optional(),
  rating: z.number().min(0).max(5).nullable().optional(),
  supplierCostValidated: z.boolean().default(false)
});

// Explicit supplier-native source status. Must be derived from the supplier
// sources actually attempted, never inferred from `supplierOptions.length === 0`.
export const SupplierSourceStatusSchema = z.enum([
  "not_attempted",
  "success",
  "partial",
  "empty",
  "failed",
  "marketplace_seller_data_available"
]);

export const NormalizedProductSchema = z.object({
  source: z.string().min(1),
  externalId: z.string().optional(),
  sourceUrl: z.string().url().optional(),
  productUrl: z.string().url().optional(),
  marketplaceUrl: z.string().url().optional(),
  supplierUrl: z.string().url().optional(),
  rawSourceSnapshotId: z.string().optional(),
  lastSeenAt: z.string().optional(),
  title: z.string().min(1),
  canonicalTitle: z.string().optional(),
  brand: z.string().optional(),
  brandConfidence: z.enum(["low", "medium", "high", "unknown"]).optional(),
  category: z.string().optional(),
  categoryPath: z.array(z.string()).optional(),
  price: z.number().nonnegative().optional(),
  priceDataStatus: z.enum(["available", "missing"]).default("available"),
  currency: z.string().min(3).max(3).optional(),
  priceUsd: z.number().nonnegative().optional(),
  originalPriceUsd: z.number().nonnegative().optional(),
  rating: z.number().min(0).max(5).optional(),
  reviewsCount: z.number().int().nonnegative().optional(),
  salesSignal: z.number().nonnegative().optional(),
  availability: z.string().optional(),
  estimatedDeliveryDays: z.number().nonnegative().nullable().optional(),
  imageUrl: z.string().url().optional(),
  supplierName: z.string().optional(),
  supplierPrice: z.number().nonnegative().optional(),
  // Real Bright Data marketplace seller candidates extracted from Amazon/eBay
  // records. Listing data only — never validated supplier cost.
  marketplaceSellers: z.array(MarketplaceSellerSchema).optional(),
  estimatedDeliveryTime: z.string().optional(),
  deliveryCostNote: z.string().optional(),
  matchConfidence: z.number().min(0).max(1).optional(),
  demandSignal: z.number().min(0).max(100).optional(),
  pricePressure: z.number().min(0).max(100).optional(),
  trendMomentum: z.number().min(0).max(100).optional(),
  inventoryRisk: z.number().min(0).max(100).optional(),
  estimatedMargin: z.number().optional(),
  riskScore: z.number().min(0).max(100).optional(),
  confidence: z.number().min(0).max(1).optional(),
  lastUpdated: z.string().min(1),
  evidenceRefs: z.array(z.string()).default([]),
  dataQuality: z.object({
    missingFields: z.array(z.string()).default([]),
    fallbackFields: z.array(z.string()).default([]),
    sourceStatus: RawSourceStatusSchema.optional()
  }).optional()
});

export const PreliminaryMetricsSchema = z.object({
  estimatedMargin: z.number(),
  demandSignal: z.number().min(0).max(100),
  pricePressure: z.number().min(0).max(100),
  supplierGap: z.number(),
  inventoryRisk: z.number().min(0).max(100),
  trendMomentum: z.number().min(0).max(100),
  opportunityScoreBase: z.number().min(0).max(100),
  productCount: z.number().int().nonnegative(),
  evidenceCount: z.number().int().nonnegative(),
  canonicalMetrics: z.record(z.union([z.number(), z.null()])).default({})
});

const GraphPointSchema = z.object({
  label: z.string(),
  value: z.number(),
  secondaryValue: z.number().optional(),
  note: z.string().optional()
});

export const GraphDataSchema = z.object({
  marginComparison: z.array(GraphPointSchema).default([]),
  supplierComparison: z.array(GraphPointSchema).default([]),
  demandTrend: z.array(GraphPointSchema).default([]),
  riskBreakdown: z.array(GraphPointSchema).default([]),
  pricePressure: z.array(GraphPointSchema).default([]),
  opportunityScore: z.array(GraphPointSchema).default([])
});

export const AgentRunStatusSchema = z.object({
  agentType: AgentTypeSchema,
  status: RuntimeAgentStatusSchema,
  label: z.string(),
  latestActivity: z.string(),
  goalIntent: z.string().optional(),
  executionOrder: z.number().int().positive().optional(),
  sourcesUsed: z.array(z.string()).default([]),
  contributionSummary: z.string().optional(),
  fallbackSignals: z.array(z.string()).default([]),
  missingSignals: z.array(z.string()).default([]),
  confidenceAdjustment: z.record(z.unknown()).default({}),
  confidence: z.number().min(0).max(1).optional(),
  riskLevel: RiskLevelSchema.optional(),
  usedFallback: z.boolean().default(false)
});

export const RecommendationMetricsSchema = z.record(z.union([z.number(), z.null()]));
export const RecommendationAgentContributionsSchema = z.object({
  orchestrator: z.string().optional(),
  inventoryInitial: z.string().optional(),
  inventoryFinal: z.string().optional(),
  trend: z.string().optional(),
  competitor: z.string().optional(),
  supplier: z.string().optional()
});
export const RecommendationSchema = z.object({
  recommendationId: z.string(),
  analysisRunId: z.string(),
  workspaceId: z.string(),
  businessGoal: BusinessGoalSchema.optional(),
  recommendedAction: z.string().min(4),
  opportunityType: z.string().optional(),
  finalScore: z.number().min(0).max(1).optional(),
  confidence: z.number().min(0).max(1).optional(),
  risk: RiskLevelSchema.optional(),
  reasoningSummary: z.string().optional(),
  metrics: RecommendationMetricsSchema.default({}),
  agentContributions: RecommendationAgentContributionsSchema.default({}),
  dataQuality: DataQualitySchema.optional(),
  evidenceRefs: z.array(z.string()).default([]),
  evidenceLinks: z.array(EvidenceLinkSchema).default([]),
  sourceUrls: z.array(EvidenceLinkSchema).default([]),
  primarySourceUrl: z.string().url().nullable().default(null),
  opportunityScore: z.number().min(0).max(100),
  estimatedMargin: z.number(),
  demandSignal: SignalStrengthSchema,
  riskLevel: RiskLevelSchema,
  confidenceLevel: ConfidenceLevelSchema,
  signalStrength: SignalStrengthSchema,
  dataFreshness: z.string().min(2),
  matchQuality: ConfidenceLevelSchema,
  primaryReason: z.string().min(4),
  suggestedNextStep: z.string().min(4),
  assistantContributions: z.array(AssistantContributionSchema).min(1),
  evidencePackageId: z.string(),
  sourceMode: SourceModeSchema.optional(),
  fallbackUsed: z.boolean().default(false),
  status: z.enum(["new", "saved", "approved", "exported"]).default("new"),
  createdAt: z.string()
});

export const AnalysisResultSchema = z.object({
  analysisRunId: z.string(),
  workspaceId: z.string(),
  analysisRun: AnalysisRunContractSchema.optional(),
  marketContext: MarketContextPayloadSchema,
  status: AnalysisStatusSchema,
  startedAt: z.string(),
  completedAt: z.string().optional(),
  sourceMode: SourceModeSchema.default("demo"),
  fallbackUsed: z.boolean().default(true),
  sourceProvider: SourceProviderSchema.default("unknown"),
  sourceProducts: z.array(z.string()).default([]),
  sourceSummary: SourceSummarySchema.optional(),
  rawSourceSnapshots: z.array(RawSourceSnapshotRecordSchema).default([]),
  rawSourceSummary: RawSourceSummarySchema.default({ success: [], partial: [], empty: [], failed: [] }),
  dataQualitySummary: DataQualitySchema.optional(),
  rawSnapshotMetadata: z.array(RawSnapshotMetadataSchema).default([]),
  evidenceMetadata: z.array(EvidenceTraceMetadataSchema).default([]),
  assistantRunTrace: z.array(AssistantRunTraceSchema).default([]),
  coordinatorTrace: CoordinatorRunTraceSchema.optional(),
  assistantStatus: z.record(AssistantIdSchema, AnalysisStatusSchema),
  sourceCollectionStatus: z.object({
    brightDataProduct: z.string(),
    mode: SourceModeSchema,
    label: z.string(),
    collectedAt: z.string(),
    providerStatus: z.union([SourceProviderStatusSchema, z.string()]).default("pending"),
    usedFallback: z.boolean().default(false),
    fallbackUsed: z.boolean().default(false),
    demoSnapshotUsed: z.boolean().default(false),
    liveProviderUsed: z.boolean().default(false),
    sourceLabel: z.string().default("Checking provider"),
    sourceProof: z.array(SourceProofItemSchema).default([]),
    liveRecordCount: z.number().int().nonnegative().default(0),
    fallbackRecordCount: z.number().int().nonnegative().default(0),
    fallbackReason: z.string().optional(),
    maxResults: z.number().int().positive().optional()
  }),
  normalizedProducts: z.array(NormalizedProductSchema).default([]),
  evidenceRefs: z.array(EvidenceRefSchema).default([]),
  preliminaryMetrics: PreliminaryMetricsSchema.optional(),
  graphData: GraphDataSchema.optional(),
  agentStatus: z.array(AgentRunStatusSchema).default([]),
  assistantRuns: z.array(AssistantRunTraceSchema).default([]),
  agentRuns: z.array(AgentOutputUnion).default([]),
  synthesis: CoordinatorSynthesisOutputSchema.optional(),
  finalVerdict: VerdictAgentOutputSchema.optional(),
  externalActionPayload: ExternalActionPayloadSchema.optional(),
  usedFallback: z.boolean().default(false),
  fallbackReason: z.string().optional(),
  executiveRecommendation: RecommendationSchema,
  recommendations: z.array(RecommendationSchema).default([]),
  opportunities: z.array(RecommendationSchema).min(1),
  assistantFindings: z.array(AssistantFindingSchema),
  evidencePackages: z.array(EvidencePackageSchema).min(1),
  supplierOptions: z.array(SupplierOptionSchema).default([]),
  // Authoritative supplier-native source state (derived from attempted sources,
  // not from supplierOptions.length). Optional so already-persisted runs parse.
  supplierSourceStatus: SupplierSourceStatusSchema.optional(),
  supplierSourcesPlanned: z.array(z.string()).default([]),
  supplierSourcesAttempted: z.array(z.string()).default([]),
  supplierMissingSignals: z.array(z.string()).default([]),
  supplierSourceReason: z.string().optional(),
  warnings: z.array(z.string()).default([]),
  demoMode: z.boolean()
});

export const AssistantUsageSchema = z.object({
  assistantId: AssistantIdSchema,
  usageCount: z.number().int().nonnegative(),
  creditLimit: z.number().int().positive(),
  creditsUsed: z.number().int().nonnegative(),
  estimatedUsageCost: z.number().nonnegative(),
  lastRun: z.string().nullable(),
  latestContribution: z.string(),
  dataSourcesUsed: z.array(z.string()),
  alertState: z.enum(["normal", "near_limit", "exceeded", "paused"])
});

export const AssistantUsageLimitPayloadSchema = z.object({
  assistantId: AssistantIdSchema,
  creditLimit: z.number().int().min(10).max(5000)
});

export const InventoryConnectionTypeSchema = z.enum([
  "marketplace_url",
  "api_key",
  "bearer_token",
  "csv_upload",
  "json_upload",
  "demo_snapshot"
]);

export const InventoryConnectionPayloadSchema = z.object({
  marketplaceName: z.string().trim().min(2).max(120),
  marketplaceUrl: z.string().trim().max(500).optional().default(""),
  connectionType: InventoryConnectionTypeSchema,
  credentialType: InventoryConnectionTypeSchema.optional(),
  credential: z.string().max(4000).optional().default(""),
  uploadedFileName: z.string().trim().max(255).optional(),
  uploadedFileType: z.enum(["csv", "json"]).optional(),
  uploadedFileSize: z.number().int().nonnegative().max(2_000_000).optional(),
  uploadedFileContent: z.string().max(1_000_000).optional()
});

export const DemoPaymentPayloadSchema = z.object({
  cardholderName: z.string().trim().min(2).max(120),
  cardNumber: z.string().trim().regex(/^[0-9 ]{12,23}$/),
  expirationMonth: z.number().int().min(1).max(12),
  expirationYear: z.number().int().min(2026).max(2045),
  ccv: z.string().trim().regex(/^[0-9]{3,4}$/),
  amountCredits: z.union([z.literal(100), z.literal(250), z.literal(500)])
});

export type AssistantId = z.infer<typeof AssistantIdSchema>;
export type RiskLevel = z.infer<typeof RiskLevelSchema>;
export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>;
export type SignalStrength = z.infer<typeof SignalStrengthSchema>;
export type NormalizedSourceMode = z.infer<typeof NormalizedSourceModeSchema>;
export type SourceMode = z.infer<typeof SourceModeSchema>;
export type SourceProvider = z.infer<typeof SourceProviderSchema>;
export type AnalysisRunMode = z.infer<typeof AnalysisRunModeSchema>;
export type CanonicalSourceMode = z.infer<typeof CanonicalSourceModeSchema>;
export type RawSourceStatus = z.infer<typeof RawSourceStatusSchema>;
export type DataQuality = z.infer<typeof DataQualitySchema>;
export type EvidenceLink = z.infer<typeof EvidenceLinkSchema>;
export type AnalysisRunContract = z.infer<typeof AnalysisRunContractSchema>;
export type RawSourceSnapshotRecord = z.infer<typeof RawSourceSnapshotRecordSchema>;
export type RawSourceSummary = z.infer<typeof RawSourceSummarySchema>;
export type SourceSummary = z.infer<typeof SourceSummarySchema>;
export type RawSnapshotMetadata = z.infer<typeof RawSnapshotMetadataSchema>;
export type EvidenceTraceMetadata = z.infer<typeof EvidenceTraceMetadataSchema>;
export type AssistantRunTrace = z.infer<typeof AssistantRunTraceSchema>;
export type CoordinatorRunTrace = z.infer<typeof CoordinatorRunTraceSchema>;
export type SourceProviderStatus = z.infer<typeof SourceProviderStatusSchema>;
export type SourceProofItem = z.infer<typeof SourceProofItemSchema>;
export type InventoryConnectionType = z.infer<typeof InventoryConnectionTypeSchema>;
export type InventorySourceStatus = z.infer<typeof InventorySourceStatusSchema>;
export type BusinessGoal = z.infer<typeof BusinessGoalSchema>;
export type RegisterPayload = z.infer<typeof RegisterPayloadSchema>;
export type LoginPayload = z.infer<typeof LoginPayloadSchema>;
export type MarketContextPayload = z.infer<typeof MarketContextPayloadSchema>;
export type AssistantContribution = z.infer<typeof AssistantContributionSchema>;
export type AssistantFinding = z.infer<typeof AssistantFindingSchema>;
export type EvidencePackage = z.infer<typeof EvidencePackageSchema>;
export type SupplierOption = z.infer<typeof SupplierOptionSchema>;
export type MarketplaceSeller = z.infer<typeof MarketplaceSellerSchema>;
export type SupplierSourceStatus = z.infer<typeof SupplierSourceStatusSchema>;
export type NormalizedProduct = z.infer<typeof NormalizedProductSchema>;
export type PreliminaryMetrics = z.infer<typeof PreliminaryMetricsSchema>;
export type GraphData = z.infer<typeof GraphDataSchema>;
export type AgentRunStatus = z.infer<typeof AgentRunStatusSchema>;
export type Recommendation = z.infer<typeof RecommendationSchema>;
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;
export type AssistantUsage = z.infer<typeof AssistantUsageSchema>;
export type InventoryConnectionPayload = z.infer<typeof InventoryConnectionPayloadSchema>;
export type DemoPaymentPayload = z.infer<typeof DemoPaymentPayloadSchema>;
