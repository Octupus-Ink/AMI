import type { EvidenceRef } from "@/lib/schemas/agents";
import type { MarketContextPayload, NormalizedProduct, PreliminaryMetrics } from "@/lib/schemas/ami";

export type AgentContext = {
  analysisRunId: string;
  briefing: MarketContextPayload;
  products: NormalizedProduct[];
  metrics: PreliminaryMetrics;
  evidenceRefs: EvidenceRef[];
  inventoryContext: {
    requested: boolean;
    available: boolean;
    warningMessage?: string;
    sourceLabel?: string;
  };
};
