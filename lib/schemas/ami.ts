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
export const SourceModeSchema = z.enum(["pending", "live", "demo_fallback", "mixed", "error", "demo_snapshot", "not_configured"]);
export const SourceProviderStatusSchema = z.enum(["pending", "live_success", "fallback_used", "partial_fallback", "failed"]);
export const SourceProofItemSchema = z.object({
  title: z.string().min(1),
  sourceType: z.enum(["brightdata", "provider", "demo_fallback", "manual", "unknown"]),
  sourceMode: z.enum(["live", "demo_fallback", "mixed"]),
  sourceUrl: z.string().url().nullable(),
  collectedAt: z.string().min(1),
  snippet: z.string().nullable(),
  isFallback: z.boolean()
});
export const BusinessGoalSchema = z.enum(["discover_new_products", "stock_optimization", "revenue_stock_opportunities"]);
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
    id: "trend",
    name: "Trend Assistant",
    role: "Detects demand signals, social momentum, seasonality, and product trend direction."
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
  },
  {
    id: "inventory",
    name: "Inventory Assistant",
    role: "Evaluates inventory posture, stock risk, margin context, and operational opportunity."
  },
  {
    id: "coordinator",
    name: "Coordinator Agent",
    role: "Compares specialist findings, detects agreements and conflicts, and isolates confidence gaps."
  },
  {
    id: "strategy",
    name: "Strategy Agent",
    role: "Converts the synthesis into AMI's final business verdict, next step, and portable action payload."
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
  sourceMarketplace: z.string(),
  sourceType: z.string(),
  sourceUrl: z.string().url().nullable().optional(),
  brightDataProduct: z.enum(["MCP Server", "Web Scraper API", "SERP API", "Web Unlocker", "Scraping Browser", "Scraper Studio"]),
  brightDataMode: SourceModeSchema,
  sourceMode: SourceModeSchema.optional(),
  isFallback: z.boolean().default(false),
  scrapedAt: z.string(),
  productIdentity: z.string(),
  currentPrice: z.number().nonnegative(),
  supplierPrice: z.number().nonnegative(),
  estimatedMargin: z.number(),
  demandIndicators: z.array(z.string()),
  socialMomentum: SignalStrengthSchema,
  competitionLevel: z.enum(["low", "moderate", "high"]),
  matchQuality: ConfidenceLevelSchema,
  matchScore: z.number().min(0).max(100),
  matchedAttributes: z.array(z.string()),
  riskInputs: z.array(z.string()),
  assistantUsed: AssistantIdSchema
});

export const SupplierOptionSchema = z.object({
  supplierName: z.string().min(2),
  source: z.string().min(2),
  estimatedUnitCost: z.number().nonnegative(),
  estimatedDeliveryTime: z.string().min(2),
  availability: z.string().min(2),
  ratingQualityProxy: z.string().min(2),
  matchConfidence: ConfidenceLevelSchema,
  risk: RiskLevelSchema
});

export const NormalizedProductSchema = z.object({
  source: z.string().min(1),
  externalId: z.string().optional(),
  title: z.string().min(1),
  canonicalTitle: z.string().optional(),
  category: z.string().optional(),
  price: z.number().nonnegative().optional(),
  currency: z.string().min(3).max(3).optional(),
  priceUsd: z.number().nonnegative().optional(),
  originalPriceUsd: z.number().nonnegative().optional(),
  rating: z.number().min(0).max(5).optional(),
  reviewsCount: z.number().int().nonnegative().optional(),
  availability: z.string().optional(),
  imageUrl: z.string().url().optional(),
  supplierName: z.string().optional(),
  supplierPrice: z.number().nonnegative().optional(),
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
  evidenceRefs: z.array(z.string()).default([])
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
  evidenceCount: z.number().int().nonnegative()
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
  confidence: z.number().min(0).max(1).optional(),
  riskLevel: RiskLevelSchema.optional(),
  usedFallback: z.boolean().default(false)
});

export const RecommendationSchema = z.object({
  recommendationId: z.string(),
  analysisRunId: z.string(),
  workspaceId: z.string(),
  recommendedAction: z.string().min(4),
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
  marketContext: MarketContextPayloadSchema,
  status: AnalysisStatusSchema,
  startedAt: z.string(),
  completedAt: z.string().optional(),
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
  agentRuns: z.array(AgentOutputUnion).default([]),
  synthesis: CoordinatorSynthesisOutputSchema.optional(),
  finalVerdict: VerdictAgentOutputSchema.optional(),
  externalActionPayload: ExternalActionPayloadSchema.optional(),
  usedFallback: z.boolean().default(false),
  fallbackReason: z.string().optional(),
  executiveRecommendation: RecommendationSchema,
  opportunities: z.array(RecommendationSchema).min(1),
  assistantFindings: z.array(AssistantFindingSchema),
  evidencePackages: z.array(EvidencePackageSchema).min(1),
  supplierOptions: z.array(SupplierOptionSchema).default([]),
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
export type SourceMode = z.infer<typeof SourceModeSchema>;
export type SourceProviderStatus = z.infer<typeof SourceProviderStatusSchema>;
export type SourceProofItem = z.infer<typeof SourceProofItemSchema>;
export type InventoryConnectionType = z.infer<typeof InventoryConnectionTypeSchema>;
export type InventorySourceStatus = z.infer<typeof InventorySourceStatusSchema>;
export type RegisterPayload = z.infer<typeof RegisterPayloadSchema>;
export type LoginPayload = z.infer<typeof LoginPayloadSchema>;
export type MarketContextPayload = z.infer<typeof MarketContextPayloadSchema>;
export type AssistantContribution = z.infer<typeof AssistantContributionSchema>;
export type AssistantFinding = z.infer<typeof AssistantFindingSchema>;
export type EvidencePackage = z.infer<typeof EvidencePackageSchema>;
export type SupplierOption = z.infer<typeof SupplierOptionSchema>;
export type NormalizedProduct = z.infer<typeof NormalizedProductSchema>;
export type PreliminaryMetrics = z.infer<typeof PreliminaryMetricsSchema>;
export type GraphData = z.infer<typeof GraphDataSchema>;
export type AgentRunStatus = z.infer<typeof AgentRunStatusSchema>;
export type Recommendation = z.infer<typeof RecommendationSchema>;
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;
export type AssistantUsage = z.infer<typeof AssistantUsageSchema>;
export type InventoryConnectionPayload = z.infer<typeof InventoryConnectionPayloadSchema>;
export type DemoPaymentPayload = z.infer<typeof DemoPaymentPayloadSchema>;
