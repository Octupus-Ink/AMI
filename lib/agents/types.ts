import type { EvidenceRef } from "@/lib/schemas/agents";
import type { MarketContextPayload, NormalizedProduct, PreliminaryMetrics } from "@/lib/schemas/ami";
import type { AgentType } from "@/lib/schemas/agents";

export type GoalWorkflowStep = {
  agentType: AgentType;
  label: string;
  goalIntent: string;
  executionOrder: number;
  optional?: boolean;
};

export type AgentContext = {
  analysisRunId: string;
  briefing: MarketContextPayload;
  products: NormalizedProduct[];
  metrics: PreliminaryMetrics;
  evidenceRefs: EvidenceRef[];
  workflow: GoalWorkflowStep[];
  dataQuality: {
    failedSources: string[];
    partialSources: string[];
    emptySources: string[];
    fallbacksUsed: string[];
    missingCriticalFields: string[];
    confidencePenaltyApplied: number;
  };
  inventoryContext: {
    requested: boolean;
    available: boolean;
    warningMessage?: string;
    sourceLabel?: string;
  };
};
