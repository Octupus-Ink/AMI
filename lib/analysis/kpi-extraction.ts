import type { NormalizedProduct, PreliminaryMetrics } from "@/lib/schemas/ami";
import { PreliminaryMetricsSchema } from "@/lib/schemas/ami";

function average(values: number[], fallback: number) {
  const usable = values.filter((value) => Number.isFinite(value));

  if (!usable.length) {
    return fallback;
  }

  return usable.reduce((sum, value) => sum + value, 0) / usable.length;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export function extractPreliminaryMetrics(products: NormalizedProduct[], evidenceCount: number): PreliminaryMetrics {
  const estimatedMargin = Number(average(products.map((product) => product.estimatedMargin ?? Number.NaN), 35).toFixed(1));
  const demandSignal = Math.round(average(products.map((product) => product.demandSignal ?? Number.NaN), 58));
  const pricePressure = Math.round(average(products.map((product) => product.pricePressure ?? Number.NaN), 55));
  const inventoryRisk = Math.round(average(products.map((product) => product.inventoryRisk ?? Number.NaN), 45));
  const trendMomentum = Math.round(average(products.map((product) => product.trendMomentum ?? Number.NaN), 60));
  const averagePrice = average(products.map((product) => product.priceUsd ?? product.price ?? Number.NaN), 30);
  const averageSupplierPrice = average(products.map((product) => product.supplierPrice ?? Number.NaN), averagePrice * 0.62);
  const supplierGap = Number((averagePrice - averageSupplierPrice).toFixed(2));
  const opportunityScoreBase = Math.round(
    clamp(estimatedMargin * 0.8 + demandSignal * 0.25 + trendMomentum * 0.2 - pricePressure * 0.12 - inventoryRisk * 0.1)
  );

  return PreliminaryMetricsSchema.parse({
    estimatedMargin,
    demandSignal,
    pricePressure,
    supplierGap,
    inventoryRisk,
    trendMomentum,
    opportunityScoreBase,
    productCount: products.length,
    evidenceCount
  });
}
