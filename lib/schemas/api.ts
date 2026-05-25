import { z } from "zod";
import type {
  CompetitorAgentOutput,
  CoordinatorAgentOutput,
  InventoryAgentOutput,
  TrendAgentOutput
} from "@/lib/schemas/agents";

export const MarketplaceProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  sku: z.string(),
  price: z.number(),
  cost: z.number(),
  currentStock: z.number(),
  targetStock: z.number(),
  monthlySales: z.number()
});

export const MarketplaceProjectSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  category: z.string(),
  targetMarket: z.string(),
  trackedCompetitors: z.array(z.string()),
  products: z.array(MarketplaceProductSchema),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const StartAnalysisRequestSchema = z.object({
  project: MarketplaceProjectSchema.optional()
});

export type MarketplaceProduct = z.infer<typeof MarketplaceProductSchema>;
export type MarketplaceProject = z.infer<typeof MarketplaceProjectSchema>;

export type RecentRun = {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  startedAt: string;
  completedAt?: string | null;
  finalScore?: number | null;
  summary: string;
};

export type AnalysisResult = {
  id: string;
  project: MarketplaceProject;
  analysisRun: {
    id: string;
    projectId: string;
    status: "pending" | "running" | "completed" | "failed";
    startedAt: string;
    completedAt?: string | null;
    agentStatus: Record<string, string>;
    finalScore?: number | null;
    summary: string;
  };
  agents: {
    competitor: CompetitorAgentOutput;
    inventory: InventoryAgentOutput;
    trend: TrendAgentOutput;
  };
  coordinator: CoordinatorAgentOutput;
  recommendations: CoordinatorAgentOutput["recommendations"];
  demoMode: boolean;
  missingEnvVars: string[];
  dataSources: Record<string, string>;
};
