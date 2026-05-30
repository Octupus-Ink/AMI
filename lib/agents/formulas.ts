export type WeightedMetric = {
  value: number | null | undefined;
  weight: number;
};

export function clamp(value: number, min = 0, max = 1) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.max(min, Math.min(max, value));
}

export function normalize(value: number | null | undefined, min: number, max: number) {
  if (value === null || value === undefined || !Number.isFinite(value) || max === min) {
    return null;
  }

  return clamp((value - min) / (max - min));
}

export function inverseNormalize(value: number | null | undefined, min: number, max: number) {
  const normalized = normalize(value, min, max);
  return normalized === null ? null : 1 - normalized;
}

export function safeDiv(a: number | null | undefined, b: number | null | undefined) {
  if (a === null || a === undefined || b === null || b === undefined || !Number.isFinite(a) || !Number.isFinite(b) || b <= 0) {
    return 0;
  }

  return a / b;
}

export function weightedAvailableScore(metrics: WeightedMetric[]) {
  const available = metrics.filter(
    (metric) =>
      metric.value !== null &&
      metric.value !== undefined &&
      Number.isFinite(metric.value) &&
      Number.isFinite(metric.weight) &&
      metric.weight > 0
  );

  const totalWeight = available.reduce((sum, metric) => sum + metric.weight, 0);

  if (totalWeight <= 0) {
    return null;
  }

  return clamp(available.reduce((sum, metric) => sum + Number(metric.value) * metric.weight, 0) / totalWeight);
}

export function grossRevenue(currentPriceUsd: number | null | undefined, projectedUnits: number | null | undefined) {
  return currentPriceUsd === null || currentPriceUsd === undefined || projectedUnits === null || projectedUnits === undefined
    ? null
    : currentPriceUsd * projectedUnits;
}

export function grossProfit(
  currentPriceUsd: number | null | undefined,
  unitCostUsd: number | null | undefined,
  projectedUnits: number | null | undefined
) {
  if (currentPriceUsd === null || currentPriceUsd === undefined || unitCostUsd === null || unitCostUsd === undefined || projectedUnits === null || projectedUnits === undefined) {
    return null;
  }

  return (currentPriceUsd - unitCostUsd) * projectedUnits;
}

export function grossMarginPct(currentPriceUsd: number | null | undefined, unitCostUsd: number | null | undefined) {
  if (currentPriceUsd === null || currentPriceUsd === undefined || unitCostUsd === null || unitCostUsd === undefined) {
    return null;
  }

  return safeDiv(currentPriceUsd - unitCostUsd, currentPriceUsd);
}

export function landedCostUsd(
  supplierPriceUsd: number | null | undefined,
  estimatedShippingUnitCostUsd = 0,
  estimatedImportFeeUnitUsd = 0,
  estimatedMarketplaceFeeUnitUsd = 0
) {
  if (supplierPriceUsd === null || supplierPriceUsd === undefined) {
    return null;
  }

  return supplierPriceUsd + estimatedShippingUnitCostUsd + estimatedImportFeeUnitUsd + estimatedMarketplaceFeeUnitUsd;
}

export function estimatedGrossMarginPct(estimatedSellingPriceUsd: number | null | undefined, landedCost: number | null | undefined) {
  if (estimatedSellingPriceUsd === null || estimatedSellingPriceUsd === undefined || landedCost === null || landedCost === undefined) {
    return null;
  }

  return safeDiv(estimatedSellingPriceUsd - landedCost, estimatedSellingPriceUsd);
}

export function estimatedROI(estimatedSellingPriceUsd: number | null | undefined, landedCost: number | null | undefined) {
  if (estimatedSellingPriceUsd === null || estimatedSellingPriceUsd === undefined || landedCost === null || landedCost === undefined) {
    return null;
  }

  return safeDiv(estimatedSellingPriceUsd - landedCost, landedCost);
}

export function demandScore(input: {
  reviewsCount?: number | null;
  boughtPastMonth?: number | null;
  soldCount?: number | null;
  bsRank?: number | null;
  rankOnPage?: number | null;
  rating?: number | null;
  maxReviews?: number;
  maxBoughtPastMonth?: number;
  maxSoldCount?: number;
  bestRank?: number;
  worstRank?: number;
  maxRankOnPage?: number;
}) {
  const reviewsSignal =
    input.reviewsCount === null || input.reviewsCount === undefined
      ? null
      : normalize(Math.log(input.reviewsCount + 1), 0, Math.log((input.maxReviews ?? 5000) + 1));
  const salesSignal =
    input.boughtPastMonth !== null && input.boughtPastMonth !== undefined
      ? normalize(input.boughtPastMonth, 0, input.maxBoughtPastMonth ?? 10000)
      : input.soldCount !== null && input.soldCount !== undefined
        ? normalize(input.soldCount, 0, input.maxSoldCount ?? 5000)
        : null;
  const rankSignal =
    input.bsRank !== null && input.bsRank !== undefined
      ? inverseNormalize(input.bsRank, input.bestRank ?? 1, input.worstRank ?? 100000)
      : input.rankOnPage !== null && input.rankOnPage !== undefined && input.rankOnPage > 0
        ? inverseNormalize(input.rankOnPage, 1, input.maxRankOnPage ?? 60)
        : null;
  const ratingSignal = input.rating === null || input.rating === undefined ? null : normalize(input.rating, 0, 5);

  return weightedAvailableScore([
    { value: reviewsSignal, weight: 0.25 },
    { value: salesSignal, weight: 0.35 },
    { value: rankSignal, weight: 0.25 },
    { value: ratingSignal, weight: 0.15 }
  ]);
}

export function trendMomentum(input: {
  engagementGrowthWeekly?: number | null;
  viewsGrowthWeekly?: number | null;
  postsPerWeek?: number | null;
  organicPostsRatio?: number | null;
  maxPostsPerWeek?: number;
}) {
  return weightedAvailableScore([
    { value: normalize(input.engagementGrowthWeekly, -1, 1), weight: 0.35 },
    { value: normalize(input.viewsGrowthWeekly, -1, 1), weight: 0.35 },
    { value: normalize(input.postsPerWeek, 0, input.maxPostsPerWeek ?? 500), weight: 0.2 },
    { value: input.organicPostsRatio ?? null, weight: 0.1 }
  ]);
}

export function competitionSaturation(input: {
  totalResults?: number | null;
  sponsoredProductCount?: number | null;
  bannerProductCount?: number | null;
  totalProductsScanned?: number | null;
  marketHighPrice?: number | null;
  marketLowPrice?: number | null;
  marketMedianPrice?: number | null;
  competitorCountSignal?: number | null;
  avgDiscountSignal?: number | null;
  maxTotalResults?: number;
}) {
  const resultVolumeSignal =
    input.totalResults === null || input.totalResults === undefined
      ? null
      : normalize(Math.log(input.totalResults + 1), 0, Math.log((input.maxTotalResults ?? 100000) + 1));
  const adPressureSignal =
    input.sponsoredProductCount === null || input.sponsoredProductCount === undefined
      ? null
      : safeDiv(input.sponsoredProductCount, input.totalProductsScanned);
  const bannerPressureSignal =
    input.bannerProductCount === null || input.bannerProductCount === undefined
      ? null
      : safeDiv(input.bannerProductCount, input.totalProductsScanned);
  const priceCompression =
    input.marketHighPrice === null ||
    input.marketHighPrice === undefined ||
    input.marketLowPrice === null ||
    input.marketLowPrice === undefined ||
    input.marketMedianPrice === null ||
    input.marketMedianPrice === undefined
      ? null
      : safeDiv(input.marketHighPrice - input.marketLowPrice, input.marketMedianPrice);

  return weightedAvailableScore([
    { value: resultVolumeSignal, weight: 0.25 },
    { value: adPressureSignal, weight: 0.2 },
    { value: bannerPressureSignal, weight: 0.1 },
    { value: priceCompression, weight: 0.15 },
    { value: input.competitorCountSignal ?? null, weight: 0.2 },
    { value: input.avgDiscountSignal ?? null, weight: 0.1 }
  ]);
}

export function pricePressureAdjusted(
  targetPriceUsd: number | null | undefined,
  competitorMedianPriceUsd: number | null | undefined,
  avgCompetitorDiscountPct: number | null | undefined
) {
  if (targetPriceUsd === null || targetPriceUsd === undefined || competitorMedianPriceUsd === null || competitorMedianPriceUsd === undefined) {
    return null;
  }

  const pricePressure = clamp(safeDiv(targetPriceUsd - competitorMedianPriceUsd, targetPriceUsd));
  return clamp(pricePressure * 0.7 + (avgCompetitorDiscountPct ?? 0) * 0.3);
}

export function supplierAvailability(input: {
  availability?: string | null;
  availableCount?: number | null;
  sellerRating?: number | null;
  sellerReviews?: number | null;
  deliveryReliabilitySignal?: number | null;
  maxAvailableCount?: number;
  maxSellerReviews?: number;
}) {
  const availabilitySignal =
    input.availability === "in_stock"
      ? 1
      : input.availability === "likely_available"
        ? 0.7
        : input.availability === "limited"
          ? 0.5
          : input.availability === "unavailable"
            ? 0
            : null;
  const quantitySignal = normalize(input.availableCount, 0, input.maxAvailableCount ?? 1000);
  const sellerTrustSignal = weightedAvailableScore([
    { value: normalize(input.sellerRating, 0, 5), weight: 0.6 },
    {
      value:
        input.sellerReviews === null || input.sellerReviews === undefined
          ? null
          : normalize(Math.log(input.sellerReviews + 1), 0, Math.log((input.maxSellerReviews ?? 5000) + 1)),
      weight: 0.4
    }
  ]);

  return weightedAvailableScore([
    { value: availabilitySignal, weight: 0.4 },
    { value: quantitySignal, weight: 0.2 },
    { value: sellerTrustSignal, weight: 0.2 },
    { value: input.deliveryReliabilitySignal ?? null, weight: 0.2 }
  ]);
}

export function deliveryRisk(estimatedDeliveryDays?: number | null, deliveryText?: string | null, availabilityDate?: string | null) {
  if (estimatedDeliveryDays !== null && estimatedDeliveryDays !== undefined && Number.isFinite(estimatedDeliveryDays)) {
    if (estimatedDeliveryDays <= 3) return 0.1;
    if (estimatedDeliveryDays <= 7) return 0.2;
    if (estimatedDeliveryDays <= 14) return 0.35;
    if (estimatedDeliveryDays <= 30) return 0.55;
    if (estimatedDeliveryDays <= 45) return 0.75;
    return 1;
  }

  if (deliveryText) {
    return 0.35;
  }

  if (availabilityDate) {
    return 0.5;
  }

  return null;
}

export function supplierRisk(input: {
  supplierRating?: number | null;
  supplierReviewCount?: number | null;
  deliveryRisk?: number | null;
  supplierAvailability?: number | null;
  matchConfidence?: number | null;
  maxSupplierReviews?: number;
}) {
  const reviewRisk =
    input.supplierReviewCount === null || input.supplierReviewCount === undefined
      ? null
      : 1 - (normalize(Math.log(input.supplierReviewCount + 1), 0, Math.log((input.maxSupplierReviews ?? 5000) + 1)) ?? 0);

  return weightedAvailableScore([
    { value: input.supplierRating === null || input.supplierRating === undefined ? null : 1 - (normalize(input.supplierRating, 0, 5) ?? 0), weight: 0.25 },
    { value: reviewRisk, weight: 0.2 },
    { value: input.deliveryRisk ?? null, weight: 0.25 },
    { value: input.supplierAvailability === null || input.supplierAvailability === undefined ? null : 1 - input.supplierAvailability, weight: 0.2 },
    { value: input.matchConfidence === null || input.matchConfidence === undefined ? null : 1 - input.matchConfidence, weight: 0.1 }
  ]);
}

export function marginSensitivity(input: {
  grossMarginPct?: number | null;
  pricePressureAdjusted?: number | null;
  supplierCostRisk?: number | null;
  discountDependency?: number | null;
}) {
  return weightedAvailableScore([
    { value: input.grossMarginPct === null || input.grossMarginPct === undefined ? null : 1 - input.grossMarginPct, weight: 0.4 },
    { value: input.pricePressureAdjusted ?? null, weight: 0.3 },
    { value: input.supplierCostRisk ?? null, weight: 0.2 },
    { value: input.discountDependency ?? null, weight: 0.1 }
  ]);
}

export function salesVelocity30d(salesLast30d?: number | null) {
  return salesLast30d === null || salesLast30d === undefined ? null : safeDiv(salesLast30d, 30);
}

export function stockCoverageDays(availableQuantity?: number | null, velocity30d?: number | null) {
  if (availableQuantity === null || availableQuantity === undefined || velocity30d === null || velocity30d === undefined || velocity30d <= 0) {
    return null;
  }

  return safeDiv(availableQuantity, velocity30d);
}

export function inventoryVelocityScore(velocity30d?: number | null, maxSalesVelocity30d = 20) {
  return normalize(velocity30d, 0, maxSalesVelocity30d);
}

export function overstockRisk(input: {
  stockCoverageDays?: number | null;
  inventoryVelocityScore?: number | null;
  demandScore?: number | null;
  pricePressureAdjusted?: number | null;
}) {
  return weightedAvailableScore([
    { value: normalize(input.stockCoverageDays, 30, 180), weight: 0.45 },
    { value: input.inventoryVelocityScore === null || input.inventoryVelocityScore === undefined ? null : 1 - input.inventoryVelocityScore, weight: 0.3 },
    { value: input.demandScore === null || input.demandScore === undefined ? null : 1 - input.demandScore, weight: 0.15 },
    { value: input.pricePressureAdjusted ?? null, weight: 0.1 }
  ]);
}

export function restockNeed(input: {
  stockCoverageDays?: number | null;
  demandScore?: number | null;
  trendMomentum?: number | null;
  competitorStockoutSignal?: number | null;
}) {
  return weightedAvailableScore([
    { value: inverseNormalize(input.stockCoverageDays, 0, 30), weight: 0.4 },
    { value: input.demandScore ?? null, weight: 0.3 },
    { value: input.trendMomentum ?? null, weight: 0.2 },
    { value: input.competitorStockoutSignal ?? null, weight: 0.1 }
  ]);
}

export function cannibalizationRisk(input: {
  categorySimilarity?: number | null;
  productSimilarity?: number | null;
  existingProductAvailableQuantity?: number | null;
  existingProductVelocityScore?: number | null;
  priceOverlapScore?: number | null;
  maxInventoryQty?: number;
}) {
  return weightedAvailableScore([
    { value: input.categorySimilarity ?? null, weight: 0.25 },
    { value: input.productSimilarity ?? null, weight: 0.3 },
    { value: normalize(input.existingProductAvailableQuantity, 0, input.maxInventoryQty ?? 500), weight: 0.2 },
    { value: input.existingProductVelocityScore === null || input.existingProductVelocityScore === undefined ? null : 1 - input.existingProductVelocityScore, weight: 0.15 },
    { value: input.priceOverlapScore ?? null, weight: 0.1 }
  ]);
}

export function strategicRestockScore(input: {
  productSimilarity?: number | null;
  existingStockCoverageDays?: number | null;
  existingProductVelocityScore?: number | null;
  demandScore?: number | null;
  trendMomentum?: number | null;
}) {
  return weightedAvailableScore([
    { value: input.productSimilarity ?? null, weight: 0.25 },
    { value: inverseNormalize(input.existingStockCoverageDays, 0, 60), weight: 0.25 },
    { value: input.existingProductVelocityScore ?? null, weight: 0.2 },
    { value: input.demandScore ?? null, weight: 0.15 },
    { value: input.trendMomentum ?? null, weight: 0.15 }
  ]);
}

export function finalMatchScore(input: {
  semanticScore?: number | null;
  attributeScore?: number | null;
  imageScore?: number | null;
  categoryScore?: number | null;
}) {
  return weightedAvailableScore([
    { value: input.semanticScore ?? null, weight: 0.35 },
    { value: input.attributeScore ?? null, weight: 0.3 },
    { value: input.imageScore ?? null, weight: 0.2 },
    { value: input.categoryScore ?? null, weight: 0.15 }
  ]);
}

export function discoverOpportunityScore(input: {
  categoryFit?: number | null;
  trendMomentum?: number | null;
  demandScore?: number | null;
  competitionWhitespace?: number | null;
  supplierViability?: number | null;
  estimatedGrossMarginPct?: number | null;
  strategicInventoryFit?: number | null;
  saturationPenalty?: number | null;
  sourcingRiskPenalty?: number | null;
  cannibalizationPenalty?: number | null;
  failedSourcePenalty?: number | null;
}) {
  const base = weightedAvailableScore([
    { value: input.categoryFit ?? null, weight: 0.15 },
    { value: input.trendMomentum ?? null, weight: 0.18 },
    { value: input.demandScore ?? null, weight: 0.17 },
    { value: input.competitionWhitespace ?? null, weight: 0.15 },
    { value: input.supplierViability ?? null, weight: 0.15 },
    { value: input.estimatedGrossMarginPct ?? null, weight: 0.1 },
    { value: input.strategicInventoryFit ?? null, weight: 0.1 }
  ]);

  return base === null
    ? null
    : clamp(base - (input.saturationPenalty ?? 0) - (input.sourcingRiskPenalty ?? 0) - (input.cannibalizationPenalty ?? 0) - (input.failedSourcePenalty ?? 0));
}

export function stockActionScore(input: {
  overstockRisk?: number | null;
  marginSensitivity?: number | null;
  pricePressureAdjusted?: number | null;
  demandScore?: number | null;
  inventoryVelocityProblem?: number | null;
  failedSourcePenalty?: number | null;
}) {
  const base = weightedAvailableScore([
    { value: input.overstockRisk ?? null, weight: 0.3 },
    { value: input.marginSensitivity ?? null, weight: 0.2 },
    { value: input.pricePressureAdjusted ?? null, weight: 0.2 },
    { value: input.demandScore === null || input.demandScore === undefined ? null : 1 - input.demandScore, weight: 0.15 },
    { value: input.inventoryVelocityProblem ?? null, weight: 0.15 }
  ]);

  return base === null ? null : clamp(base - (input.failedSourcePenalty ?? 0));
}

export function stockProtectionScore(input: {
  restockNeed?: number | null;
  demandScore?: number | null;
  trendMomentum?: number | null;
  competitorStockoutSignal?: number | null;
}) {
  return weightedAvailableScore([
    { value: input.restockNeed ?? null, weight: 0.35 },
    { value: input.demandScore ?? null, weight: 0.25 },
    { value: input.trendMomentum ?? null, weight: 0.2 },
    { value: input.competitorStockoutSignal ?? null, weight: 0.2 }
  ]);
}

export function revenueOpportunityScore(input: {
  demandScore?: number | null;
  trendMomentum?: number | null;
  inventoryAvailabilityScore?: number | null;
  estimatedGrossMarginPct?: number | null;
  competitionWhitespace?: number | null;
  restockNeed?: number | null;
  supplierAvailability?: number | null;
  marginSensitivityPenalty?: number | null;
  deliveryRiskPenalty?: number | null;
  failedSourcePenalty?: number | null;
}) {
  const base = weightedAvailableScore([
    { value: input.demandScore ?? null, weight: 0.2 },
    { value: input.trendMomentum ?? null, weight: 0.12 },
    { value: input.inventoryAvailabilityScore ?? null, weight: 0.15 },
    { value: input.estimatedGrossMarginPct ?? null, weight: 0.2 },
    { value: input.competitionWhitespace ?? null, weight: 0.1 },
    { value: input.restockNeed ?? null, weight: 0.1 },
    { value: input.supplierAvailability ?? null, weight: 0.13 }
  ]);

  return base === null
    ? null
    : clamp(base - (input.marginSensitivityPenalty ?? 0) - (input.deliveryRiskPenalty ?? 0) - (input.failedSourcePenalty ?? 0));
}

export function sourceReliability(sourceStatus?: string | null) {
  if (sourceStatus === "success") return 1;
  if (sourceStatus === "partial") return 0.7;
  if (sourceStatus === "empty") return 0.45;
  if (sourceStatus === "failed") return 0.25;
  return 0.5;
}

export function fieldCompleteness(availableCriticalFields: number, totalCriticalFields: number) {
  return clamp(safeDiv(availableCriticalFields, totalCriticalFields));
}

export function fallbackPenalty(numberOfCriticalFallbacks: number) {
  return Math.min(numberOfCriticalFallbacks * 0.04, 0.2);
}

export function failedSourcePenalty(numberOfFailedRequiredSources: number) {
  return Math.min(numberOfFailedRequiredSources * 0.08, 0.24);
}

export function confidence(input: {
  fieldCompleteness?: number | null;
  sourceReliability?: number | null;
  sourceFreshness?: number | null;
  matchQuality?: number | null;
  agentAgreement?: number | null;
  fallbackPenalty?: number | null;
  contradictionPenalty?: number | null;
}) {
  const base = weightedAvailableScore([
    { value: input.fieldCompleteness ?? null, weight: 0.25 },
    { value: input.sourceReliability ?? null, weight: 0.2 },
    { value: input.sourceFreshness ?? null, weight: 0.15 },
    { value: input.matchQuality ?? null, weight: 0.2 },
    { value: input.agentAgreement ?? null, weight: 0.2 }
  ]);

  return base === null ? null : clamp(base - (input.fallbackPenalty ?? 0) - (input.contradictionPenalty ?? 0));
}
