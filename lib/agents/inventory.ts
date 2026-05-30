import { InventoryAgentOutputSchema, type InventoryAgentOutput } from "@/lib/schemas/agents";
import type { AgentContext } from "@/lib/agents/types";

export function runInventoryAgent(context: AgentContext): InventoryAgentOutput {
  const { briefing, inventoryContext, metrics, evidenceRefs } = context;
  const goalIntent =
    briefing.businessGoal === "discover_new_products"
      ? "Map current marketplace categories, cannibalization zones, and replacement opportunities."
      : briefing.businessGoal === "stock_optimization"
        ? "Diagnose slow-moving stock, overstock, low stock, margin sensitivity, and operational risk."
        : "Find products with revenue, margin, bundle, or restock upside.";

  if (inventoryContext.requested && !inventoryContext.available) {
    return InventoryAgentOutputSchema.parse({
      agentType: "inventory",
      status: "warning",
      finding: "Inventory context was requested but no usable source is connected.",
      reasoning: `${goalIntent} ${inventoryContext.warningMessage ?? "AMI continued with market, competitor, and supplier signals only."}`,
      confidence: 0.52,
      riskLevel: "medium",
      suggestedAction: "Connect or refresh inventory before acting on stock-sensitive recommendations.",
      evidenceUsed: evidenceRefs.slice(0, 2).map((ref) => ref.id),
      sourceAgents: [],
      stockPosture: "unavailable",
      stockMovementRisk: "medium",
      promotionOpportunity: "Use a limited promotion only if operational context is verified."
    });
  }

  if (!inventoryContext.requested) {
    return InventoryAgentOutputSchema.parse({
      agentType: "inventory",
      status: "skipped",
      finding: "Inventory context was not required for this briefing.",
      reasoning: `${goalIntent} AMI treated inventory as optional and used market, competitor, and supplier evidence.`,
      confidence: 0.62,
      riskLevel: metrics.inventoryRisk >= 65 ? "medium" : "low",
      suggestedAction: "Use inventory context before scaling restock or clearance decisions.",
      evidenceUsed: evidenceRefs.slice(0, 2).map((ref) => ref.id),
      sourceAgents: [],
      stockPosture: "not requested",
      stockMovementRisk: `${metrics.inventoryRisk}/100`,
      promotionOpportunity: "Evaluate after product velocity is observed."
    });
  }

  return InventoryAgentOutputSchema.parse({
    agentType: "inventory",
    status: "completed",
    finding: metrics.inventoryRisk >= 65
      ? "Inventory risk is elevated; action should stay controlled."
      : "Inventory posture supports a limited commercial test.",
    reasoning: `${goalIntent} Inventory risk is ${metrics.inventoryRisk}/100 with estimated margin ${metrics.estimatedMargin.toFixed(1)}%.`,
    confidence: Math.min(0.85, 0.58 + (100 - metrics.inventoryRisk) / 250),
    riskLevel: metrics.inventoryRisk >= 75 ? "high" : metrics.inventoryRisk >= 50 ? "medium" : "low",
    suggestedAction: metrics.inventoryRisk >= 65
      ? "Avoid aggressive restocking until velocity confirms demand."
      : "Use a limited promotion or sourcing validation before expanding stock.",
    evidenceUsed: evidenceRefs.slice(0, 2).map((ref) => ref.id),
    sourceAgents: [],
    stockPosture: inventoryContext.sourceLabel ?? "workspace inventory context",
    stockMovementRisk: `${metrics.inventoryRisk}/100`,
    promotionOpportunity: metrics.pricePressure >= 60 ? "short promotion can test velocity" : "promotion optional"
  });
}
