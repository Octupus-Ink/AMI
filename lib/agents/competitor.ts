import { CompetitorAgentOutputSchema, type CompetitorAgentOutput } from "@/lib/schemas/agents";
import type { AgentContext } from "@/lib/agents/types";

export function runCompetitorAgent(context: AgentContext): CompetitorAgentOutput {
  const { briefing, metrics, products, evidenceRefs } = context;
  const highPressure = metrics.pricePressure >= 68;
  const availabilityGaps = products.filter((product) => product.availability?.toLowerCase().includes("limited")).length;

  return CompetitorAgentOutputSchema.parse({
    agentType: "competitor",
    status: "completed",
    finding: highPressure
      ? "Competitor pricing pressure is high enough to favor a controlled promotion."
      : "Competitor pressure is present but leaves room for margin-protected action.",
    reasoning: `${briefing.targetMarketplace} signals show price pressure ${metrics.pricePressure}/100 across ${products.length} normalized product records.`,
    confidence: Math.min(0.88, 0.58 + products.length / 15 + metrics.pricePressure / 400),
    riskLevel: highPressure ? "medium" : "low",
    suggestedAction: highPressure
      ? "Test a short promotional move before increasing inventory exposure."
      : "Preserve price discipline while monitoring competitor changes.",
    evidenceUsed: evidenceRefs.slice(0, 3).map((ref) => ref.id),
    sourceAgents: [],
    pricingPressure: `${metrics.pricePressure}/100`,
    marketSaturation: highPressure ? "elevated" : "manageable",
    availabilityGaps: availabilityGaps ? `${availabilityGaps} limited listings observed` : "No major availability gap detected"
  });
}
