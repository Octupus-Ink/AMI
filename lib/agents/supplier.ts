import { SupplierAgentOutputSchema, type SupplierAgentOutput } from "@/lib/schemas/agents";
import type { AgentContext } from "@/lib/agents/types";

function average(values: number[], fallback: number) {
  const usable = values.filter((value) => Number.isFinite(value));
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : fallback;
}

export function runSupplierAgent(context: AgentContext): SupplierAgentOutput {
  const { briefing, metrics, products, evidenceRefs, dataQuality } = context;
  const avgMatch = average(products.map((product) => product.matchConfidence ?? Number.NaN), 0.64);
  const marginViable = metrics.estimatedMargin >= 30;
  const deliveryUnknown = products.some((product) => product.estimatedDeliveryTime?.toLowerCase().includes("validation"));
  const supplierSourceFailed = dataQuality.failedSources.some((source) => /alibaba|aliexpress/i.test(source));
  const supplierSourceEmpty = dataQuality.emptySources.some((source) => /alibaba|aliexpress/i.test(source));
  const supplierUnavailable = supplierSourceFailed || supplierSourceEmpty;
  const goalIntent =
    briefing.businessGoal === "discover_new_products"
      ? "Validate sourcing feasibility for non-saturated new candidates."
      : briefing.businessGoal === "stock_optimization"
        ? "Validate alternative supplier or restock only if needed."
        : "Validate restock, supplier leverage, margin expansion, and sourcing risk.";

  return SupplierAgentOutputSchema.parse({
    agentType: "supplier",
    status: supplierUnavailable ? "warning" : "completed",
    finding: supplierUnavailable
      ? "Supplier source signal is unknown; direct sourcing should become validation."
      : marginViable
        ? "Supplier margin appears viable but delivery terms still need validation."
        : "Supplier economics are not strong enough for immediate sourcing approval.",
    reasoning: `${goalIntent} Supplier gap is ${metrics.supplierGap.toFixed(2)} ${briefing.currency} with estimated margin ${metrics.estimatedMargin.toFixed(1)}%.${
      supplierUnavailable ? " Alibaba/AliExpress did not provide usable supplier availability, so AMI did not convert availability to zero." : ""
    }`,
    confidence: Math.max(0.35, Math.min(0.86, 0.5 + avgMatch * 0.35 + Math.max(0, metrics.estimatedMargin) / 250 - (supplierUnavailable ? 0.1 : 0))),
    riskLevel: supplierUnavailable || deliveryUnknown || avgMatch < 0.7 ? "medium" : marginViable ? "low" : "high",
    suggestedAction: "Validate supplier delivery cost, delivery time, and product match before approving sourcing.",
    evidenceUsed: evidenceRefs.slice(0, 3).map((ref) => ref.id),
    sourceAgents: [],
    marginPotential: marginViable ? "viable" : "weak",
    sourcingRisk: deliveryUnknown ? "delivery validation required" : "manageable",
    matchConfidence: `${Math.round(avgMatch * 100)}%`
  });
}
