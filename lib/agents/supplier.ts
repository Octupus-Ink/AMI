import { SupplierAgentOutputSchema, type SupplierAgentOutput } from "@/lib/schemas/agents";
import type { AgentContext } from "@/lib/agents/types";

function average(values: number[], fallback: number) {
  const usable = values.filter((value) => Number.isFinite(value));
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : fallback;
}

function supplierSourceText(product: AgentContext["products"][number]) {
  return [
    product.source,
    product.sourceUrl,
    product.productUrl,
    product.marketplaceUrl,
    product.supplierUrl
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .toLowerCase();
}

function hasPrimarySupplierCost(product: AgentContext["products"][number]) {
  const hasPositiveCost = Number.isFinite(product.supplierPrice) && (product.supplierPrice ?? 0) > 0;
  const source = supplierSourceText(product);
  const isSupplierMarketplace = /alibaba|aliexpress|1688\.com|dhgate|made-in-china|globalsources|indiamart/.test(source);
  const isFallbackOnly =
    product.dataQuality?.fallbackFields?.some((field) => /fallback|demo|missing_cost|web_unlocker/i.test(field)) ||
    /web unlocker|demo fallback|fallback snapshot|demo seed/.test(source);

  return hasPositiveCost && isSupplierMarketplace && !isFallbackOnly;
}

export function runSupplierAgent(context: AgentContext): SupplierAgentOutput {
  const { briefing, metrics, products, evidenceRefs, dataQuality } = context;
  const avgMatch = average(products.map((product) => product.matchConfidence ?? Number.NaN), 0.64);

  const deliveryUnknown = products.some((product) => product.estimatedDeliveryTime?.toLowerCase().includes("validation"));

  const supplierSourceFailed = dataQuality.failedSources.some((source) => /alibaba|aliexpress/i.test(source));
  const supplierSourceEmpty = dataQuality.emptySources.some((source) => /alibaba|aliexpress/i.test(source));
  const supplierUnavailable = supplierSourceFailed || supplierSourceEmpty;

  // Supplier cost availability must be checked directly from products where possible.
  // IMPORTANT: generic marketplace, Web Unlocker, and fallback-only records do not prove supplier cost.
  const hasDirectSupplierCost = products.some(hasPrimarySupplierCost);
  const supplierCostIsFallbackOnly = dataQuality.fallbacksUsed.some((source) => /fallback|demo|snapshot|web unlocker/i.test(source));

  const supplierCostMissing = supplierCostIsFallbackOnly || !hasDirectSupplierCost || !Number.isFinite(metrics.estimatedMargin);
  const marginViable = !supplierCostMissing && metrics.estimatedMargin >= 30;

  const goalIntent =
    briefing.businessGoal === "discover_new_products"
      ? "Validate sourcing feasibility for non-saturated new candidates."
      : briefing.businessGoal === "stock_optimization"
        ? "Validate alternative supplier or restock only if needed."
        : "Validate restock, supplier leverage, margin expansion, and sourcing risk.";

  const supplierCostValidationMessage =
    "Supplier cost unavailable. Demand may be validated from market signals, but sourcing viability requires supplier pricing, delivery, and availability confirmation.";

  const status: SupplierAgentOutput["status"] = supplierCostMissing || supplierUnavailable ? "warning" : "completed";

  const finding = supplierCostMissing
    ? supplierCostValidationMessage
    : supplierUnavailable
      ? "Supplier source signal is unknown; direct sourcing should become validation."
      : marginViable
        ? "Supplier margin appears viable but delivery terms still need validation."
        : "Supplier economics are not strong enough for immediate sourcing approval.";

  const reasoning = supplierCostMissing
    ? supplierCostValidationMessage
    : `${goalIntent} Supplier gap is ${metrics.supplierGap.toFixed(2)} ${briefing.currency} with estimated margin ${metrics.estimatedMargin.toFixed(1)}%.${supplierUnavailable ? " Alibaba/AliExpress did not provide usable supplier availability, so AMI did not convert availability to zero." : ""}`;

  return SupplierAgentOutputSchema.parse({
    agentType: "supplier",
    status,
    finding,
    reasoning,
    confidence: supplierCostMissing
      ? Math.max(0.35, Math.min(0.7, 0.45 + avgMatch * 0.3 - (supplierUnavailable ? 0.05 : 0)))
      : Math.max(0.35, Math.min(0.86, 0.5 + avgMatch * 0.35 + Math.max(0, metrics.estimatedMargin) / 250 - (supplierUnavailable ? 0.1 : 0))),
    riskLevel: supplierCostMissing || supplierUnavailable || deliveryUnknown || avgMatch < 0.7 ? "medium" : marginViable ? "low" : "high",
    suggestedAction: "Validate supplier delivery cost, delivery time, and product match before approving sourcing.",
    evidenceUsed: evidenceRefs.slice(0, 3).map((ref) => ref.id),
    sourceAgents: [],
    // Avoid "viable/ROI/commercially viable" implications when supplier cost is missing.
    marginPotential: supplierCostMissing ? supplierCostValidationMessage : marginViable ? "viable" : "weak",
    sourcingRisk: supplierCostMissing ? supplierCostValidationMessage : deliveryUnknown ? "delivery validation required" : "manageable",
    matchConfidence: `${Math.round(avgMatch * 100)}%`
  });
}
