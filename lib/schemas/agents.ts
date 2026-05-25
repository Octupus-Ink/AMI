import { z } from "zod";

export const AgentStatusSchema = z.enum(["pending", "running", "completed", "failed"]);
export const RiskLevelSchema = z.enum(["low", "medium", "high"]);

export const CompetitorFindingSchema = z.object({
  competitorName: z.string(),
  productName: z.string(),
  price: z.number(),
  stockStatus: z.enum(["in_stock", "low_stock", "out_of_stock", "unknown"]),
  discountDetected: z.boolean(),
  discountPercentage: z.number(),
  deliveryEstimate: z.string(),
  riskLevel: RiskLevelSchema,
  insight: z.string()
});

export const CompetitorAgentOutputSchema = z.object({
  agent: z.literal("competitor"),
  status: z.literal("completed"),
  findings: z.array(CompetitorFindingSchema),
  summary: z.string(),
  confidence: z.number().min(0).max(1)
});

export const InventoryFindingSchema = z.object({
  productName: z.string(),
  currentStock: z.number(),
  salesVelocity: z.enum(["slow", "normal", "fast"]),
  inventoryRisk: z.enum(["overstock", "low_stock", "stagnant", "healthy"]),
  profitMarginEstimate: z.number(),
  recommendedAction: z.string(),
  riskLevel: RiskLevelSchema
});

export const InventoryAgentOutputSchema = z.object({
  agent: z.literal("inventory"),
  status: z.literal("completed"),
  findings: z.array(InventoryFindingSchema),
  summary: z.string(),
  confidence: z.number().min(0).max(1)
});

export const TrendFindingSchema = z.object({
  productName: z.string(),
  trendScore: z.number(),
  marketStatus: z.enum(["declining", "stable", "growing", "viral"]),
  seasonality: z.enum(["low", "medium", "high"]),
  demandSignal: z.enum(["weak", "moderate", "strong"]),
  recommendation: z.string()
});

export const TrendAgentOutputSchema = z.object({
  agent: z.literal("trend"),
  status: z.literal("completed"),
  findings: z.array(TrendFindingSchema),
  summary: z.string(),
  confidence: z.number().min(0).max(1)
});

export const CoordinatorRecommendationSchema = z.object({
  priority: z.enum(["low", "medium", "high", "critical"]),
  title: z.string(),
  description: z.string(),
  sourceAgents: z.array(z.enum(["competitor", "inventory", "trend"])),
  businessImpact: z.string(),
  suggestedAction: z.string()
});

export const CoordinatorAgentOutputSchema = z.object({
  status: z.literal("completed"),
  marketplaceHealthScore: z.number().min(0).max(100),
  executiveSummary: z.string(),
  recommendations: z.array(CoordinatorRecommendationSchema),
  nextBestActions: z.array(z.string()),
  risks: z.array(z.string())
});

export type AgentStatus = z.infer<typeof AgentStatusSchema>;
export type CompetitorAgentOutput = z.infer<typeof CompetitorAgentOutputSchema>;
export type InventoryAgentOutput = z.infer<typeof InventoryAgentOutputSchema>;
export type TrendAgentOutput = z.infer<typeof TrendAgentOutputSchema>;
export type CoordinatorAgentOutput = z.infer<typeof CoordinatorAgentOutputSchema>;
export type CoordinatorRecommendation = z.infer<typeof CoordinatorRecommendationSchema>;
