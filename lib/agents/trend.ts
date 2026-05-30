import { TrendAgentOutputSchema, type TrendAgentOutput } from "@/lib/schemas/agents";
import type { AgentContext } from "@/lib/agents/types";

export function runTrendAgent(context: AgentContext): TrendAgentOutput {
  const { briefing, metrics, evidenceRefs, dataQuality } = context;
  const strong = metrics.demandSignal >= 70 || metrics.trendMomentum >= 70;
  const moderate = metrics.demandSignal >= 45 || metrics.trendMomentum >= 45;
  const socialSourceFailed = dataQuality.failedSources.some((source) => /tiktok|facebook/i.test(source));
  const goalIntent =
    briefing.businessGoal === "discover_new_products"
      ? "Find category-aligned emerging or growing products."
      : briefing.businessGoal === "stock_optimization"
        ? "Check whether current stock demand is declining, stable, or recovering."
        : "Validate demand upside among current stock categories and products.";

  return TrendAgentOutputSchema.parse({
    agentType: "trend",
    status: socialSourceFailed ? "warning" : "completed",
    finding: strong
      ? "Demand momentum supports near-term commercial action."
      : moderate
        ? "Demand is present but does not yet justify aggressive scaling."
        : "Demand signal is weak and should be validated before action.",
    reasoning: `${goalIntent} AMI found demand signal ${metrics.demandSignal}/100 and trend momentum ${metrics.trendMomentum}/100 for ${briefing.productName}.${
      socialSourceFailed ? " Social trend collection failed, so marketplace demand fallback was used instead of setting trend to zero." : ""
    }`,
    confidence: Math.max(0.35, Math.min(0.9, 0.55 + metrics.trendMomentum / 250 - (socialSourceFailed ? 0.08 : 0))),
    riskLevel: strong ? "low" : moderate ? "medium" : "high",
    suggestedAction: strong
      ? "Use the current demand window for a limited market test."
      : "Monitor trend movement before committing to a larger inventory action.",
    evidenceUsed: evidenceRefs.slice(0, 3).map((ref) => ref.id),
    sourceAgents: [],
    demand: `${metrics.demandSignal}/100`,
    momentum: `${metrics.trendMomentum}/100`,
    seasonality: briefing.category,
    trendDirection: strong ? "growing" : moderate ? "stable" : "unknown"
  });
}
