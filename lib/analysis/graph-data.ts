import type { GraphData, NormalizedProduct, PreliminaryMetrics } from "@/lib/schemas/ami";
import { GraphDataSchema } from "@/lib/schemas/ami";

function labelForProduct(product: NormalizedProduct, index: number) {
  return product.title.length > 34 ? `${product.title.slice(0, 31)}...` : product.title || `Product ${index + 1}`;
}

function numberOr(value: number | undefined, fallback: number) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

export function buildGraphData(products: NormalizedProduct[], metrics: PreliminaryMetrics): GraphData {
  const scoped = products.slice(0, 5);

  return GraphDataSchema.parse({
    marginComparison: scoped.map((product, index) => ({
      label: labelForProduct(product, index),
      value: numberOr(product.estimatedMargin, metrics.estimatedMargin),
      secondaryValue: numberOr(product.priceUsd ?? product.price, 0),
      note: product.supplierName
    })),
    supplierComparison: scoped.map((product, index) => ({
      label: product.supplierName ?? `Supplier ${index + 1}`,
      value: numberOr(product.supplierPrice, 0),
      secondaryValue: numberOr(product.matchConfidence, 0) * 100,
      note: product.estimatedDeliveryTime
    })),
    demandTrend: scoped.map((product, index) => ({
      label: `Signal ${index + 1}`,
      value: numberOr(product.demandSignal, metrics.demandSignal),
      secondaryValue: numberOr(product.trendMomentum, metrics.trendMomentum),
      note: product.availability
    })),
    riskBreakdown: [
      { label: "Inventory risk", value: metrics.inventoryRisk },
      { label: "Price pressure", value: metrics.pricePressure },
      { label: "Supplier gap risk", value: Math.max(0, 100 - Math.min(100, Math.round(metrics.supplierGap * 4))) }
    ],
    pricePressure: scoped.map((product, index) => ({
      label: labelForProduct(product, index),
      value: numberOr(product.pricePressure, metrics.pricePressure),
      secondaryValue: numberOr(product.priceUsd ?? product.price, 0)
    })),
    opportunityScore: [
      {
        label: "Base opportunity",
        value: metrics.opportunityScoreBase,
        note: "Calculated before AI synthesis"
      }
    ]
  });
}
