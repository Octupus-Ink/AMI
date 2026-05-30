import type { NormalizedProduct, PreliminaryMetrics } from "@/lib/schemas/ami";
import { PreliminaryMetricsSchema } from "@/lib/schemas/ami";
import {
  cannibalizationRisk,
  competitionSaturation,
  confidence,
  demandScore,
  deliveryRisk,
  discoverOpportunityScore,
  estimatedGrossMarginPct,
  estimatedROI,
  failedSourcePenalty,
  fieldCompleteness,
  finalMatchScore,
  grossMarginPct,
  inventoryVelocityScore,
  marginSensitivity,
  normalize,
  overstockRisk,
  pricePressureAdjusted,
  restockNeed,
  revenueOpportunityScore,
  safeDiv,
  sourceReliability,
  stockActionScore,
  stockCoverageDays,
  stockProtectionScore,
  strategicRestockScore,
  supplierAvailability,
  supplierRisk,
  trendMomentum,
  weightedAvailableScore
} from "@/lib/agents/formulas";

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
  const trendMomentumScore = Math.round(average(products.map((product) => product.trendMomentum ?? Number.NaN), 60));
  const averagePrice = average(products.map((product) => product.priceUsd ?? product.price ?? Number.NaN), 30);
  const averageSupplierPrice = average(products.map((product) => product.supplierPrice ?? Number.NaN), Number.NaN);
  const supplierGap = Number.isFinite(averageSupplierPrice) ? Number((averagePrice - averageSupplierPrice).toFixed(2)) : 0;
  const opportunityScoreBase = Math.round(
    clamp(estimatedMargin * 0.8 + demandSignal * 0.25 + trendMomentumScore * 0.2 - pricePressure * 0.12 - inventoryRisk * 0.1)
  );
  const primary = products[0];
  const prices = products.map((product) => product.priceUsd ?? product.price).filter((value): value is number => Number.isFinite(value));
  const medianPrice = prices.length ? prices.sort((a, b) => a - b)[Math.floor(prices.length / 2)] : null;
  const highPrice = prices.length ? Math.max(...prices) : null;
  const lowPrice = prices.length ? Math.min(...prices) : null;
  const coreDemandScore = demandScore({
    reviewsCount: primary?.reviewsCount ?? null,
    boughtPastMonth: primary?.salesSignal ?? null,
    soldCount: primary?.salesSignal ?? null,
    rankOnPage: null,
    rating: primary?.rating ?? null
  });
  const marketplaceTrend = trendMomentum({
    engagementGrowthWeekly: null,
    viewsGrowthWeekly: null,
    postsPerWeek: primary?.salesSignal ?? primary?.reviewsCount ?? null,
    organicPostsRatio: primary?.source?.toLowerCase().includes("tiktok") || primary?.source?.toLowerCase().includes("facebook") ? 0.74 : null
  });
  const saturation = competitionSaturation({
    totalResults: null,
    sponsoredProductCount: null,
    bannerProductCount: null,
    totalProductsScanned: products.length,
    marketHighPrice: highPrice,
    marketLowPrice: lowPrice,
    marketMedianPrice: medianPrice,
    competitorCountSignal: normalize(products.length, 0, 10),
    avgDiscountSignal: primary?.originalPriceUsd && primary?.priceUsd ? safeDiv(primary.originalPriceUsd - primary.priceUsd, primary.originalPriceUsd) : null
  });
  const adjustedPressure = pricePressureAdjusted(primary?.priceUsd ?? primary?.price ?? null, medianPrice, null);
  const delivery = deliveryRisk(primary?.estimatedDeliveryDays ?? null, primary?.estimatedDeliveryTime ?? null, null);
  const supplierAvailable = supplierAvailability({
    availability: primary?.availability ?? null,
    sellerRating: primary?.rating ?? null,
    sellerReviews: primary?.reviewsCount ?? null,
    deliveryReliabilitySignal: delivery === null ? null : 1 - delivery
  });
  const supplierRiskScore = supplierRisk({
    supplierRating: primary?.rating ?? null,
    supplierReviewCount: primary?.reviewsCount ?? null,
    deliveryRisk: delivery,
    supplierAvailability: supplierAvailable,
    matchConfidence: primary?.matchConfidence ?? null
  });
  const marginPct = grossMarginPct(primary?.priceUsd ?? primary?.price ?? null, primary?.supplierPrice ?? null);
  const estimatedMarginPct = estimatedGrossMarginPct(primary?.priceUsd ?? primary?.price ?? null, primary?.supplierPrice ?? null);
  const roi = estimatedROI(primary?.priceUsd ?? primary?.price ?? null, primary?.supplierPrice ?? null);
  const velocityScore = inventoryVelocityScore(primary?.salesSignal ?? null, 500);
  const coverageDays = stockCoverageDays(null, null);
  const overstock = overstockRisk({
    stockCoverageDays: coverageDays,
    inventoryVelocityScore: velocityScore,
    demandScore: coreDemandScore,
    pricePressureAdjusted: adjustedPressure
  });
  const restock = restockNeed({
    stockCoverageDays: coverageDays,
    demandScore: coreDemandScore,
    trendMomentum: marketplaceTrend,
    competitorStockoutSignal: primary?.availability === "limited" ? 0.6 : null
  });
  const cannibalization = cannibalizationRisk({
    categorySimilarity: primary?.category ? 0.65 : null,
    productSimilarity: primary?.matchConfidence ?? null,
    existingProductAvailableQuantity: null,
    existingProductVelocityScore: velocityScore,
    priceOverlapScore: null
  });
  const strategicRestock = strategicRestockScore({
    productSimilarity: primary?.matchConfidence ?? null,
    existingStockCoverageDays: coverageDays,
    existingProductVelocityScore: velocityScore,
    demandScore: coreDemandScore,
    trendMomentum: marketplaceTrend
  });
  const matchScore = finalMatchScore({
    semanticScore: primary?.matchConfidence ?? null,
    attributeScore: primary?.category ? 0.75 : null,
    imageScore: primary?.imageUrl ? 0.8 : null,
    categoryScore: primary?.category ? 0.8 : null
  });
  const competitionWhitespace = saturation === null ? null : 1 - saturation;
  const supplierViability = weightedAvailableScore([
    { value: supplierAvailable, weight: 0.35 },
    { value: estimatedMarginPct, weight: 0.3 },
    { value: primary?.matchConfidence ?? null, weight: 0.2 },
    { value: supplierRiskScore === null ? null : 1 - supplierRiskScore, weight: 0.15 }
  ]);
  const strategicInventoryFit =
    cannibalization === null && strategicRestock === null ? null : Math.max(cannibalization === null ? 0 : 1 - cannibalization, strategicRestock ?? 0);
  const requiredFailedSources = 0;
  const sourcePenalty = failedSourcePenalty(requiredFailedSources);
  const discoverScore = discoverOpportunityScore({
    categoryFit: primary?.category ? 0.75 : null,
    trendMomentum: marketplaceTrend,
    demandScore: coreDemandScore,
    competitionWhitespace,
    supplierViability,
    estimatedGrossMarginPct: estimatedMarginPct,
    strategicInventoryFit,
    saturationPenalty: saturation === null ? null : saturation * 0.15,
    sourcingRiskPenalty: supplierRiskScore === null ? null : supplierRiskScore * 0.12,
    cannibalizationPenalty: strategicRestock !== null && strategicRestock > 0.7 ? 0 : (cannibalization ?? 0) * 0.1,
    failedSourcePenalty: sourcePenalty
  });
  const marginSensitive = marginSensitivity({
    grossMarginPct: marginPct,
    pricePressureAdjusted: adjustedPressure,
    supplierCostRisk: null,
    discountDependency: null
  });
  const stockAction = stockActionScore({
    overstockRisk: overstock,
    marginSensitivity: marginSensitive,
    pricePressureAdjusted: adjustedPressure,
    demandScore: coreDemandScore,
    inventoryVelocityProblem: velocityScore === null ? null : 1 - velocityScore,
    failedSourcePenalty: sourcePenalty
  });
  const stockProtection = stockProtectionScore({
    restockNeed: restock,
    demandScore: coreDemandScore,
    trendMomentum: marketplaceTrend,
    competitorStockoutSignal: primary?.availability === "limited" ? 0.6 : null
  });
  const revenueScore = revenueOpportunityScore({
    demandScore: coreDemandScore,
    trendMomentum: marketplaceTrend,
    inventoryAvailabilityScore: primary?.availability === "in_stock" ? 0.8 : primary?.availability === "limited" ? 0.45 : null,
    estimatedGrossMarginPct: estimatedMarginPct,
    competitionWhitespace,
    restockNeed: restock,
    supplierAvailability: supplierAvailable,
    marginSensitivityPenalty: marginSensitive === null ? null : marginSensitive * 0.1,
    deliveryRiskPenalty: delivery === null ? null : delivery * 0.08,
    failedSourcePenalty: sourcePenalty
  });
  const missingCriticalFields = [
    primary?.priceDataStatus === "missing" ? "price" : "",
    primary?.supplierPrice === undefined ? "supplierPrice" : "",
    primary?.reviewsCount === undefined ? "reviewsCount" : "",
    primary?.estimatedDeliveryDays === null ? "supplier_delivery_days" : ""
  ].filter(Boolean).length;
  const completeness = fieldCompleteness(3 - missingCriticalFields, 3);
  const reliability = sourceReliability(primary?.dataQuality?.sourceStatus);
  const confidenceScore = confidence({
    fieldCompleteness: completeness,
    sourceReliability: reliability,
    sourceFreshness: 0.9,
    matchQuality: matchScore,
    agentAgreement: 0.74,
    fallbackPenalty: 0,
    contradictionPenalty: 0
  });
  const canonicalMetrics = {
    demandScore: coreDemandScore,
    trendMomentum: marketplaceTrend,
    competitionSaturation: saturation,
    competitionWhitespace,
    pricePressureAdjusted: adjustedPressure,
    supplierAvailability: supplierAvailable,
    deliveryRisk: delivery,
    supplierRisk: supplierRiskScore,
    estimatedGrossMarginPct: estimatedMarginPct,
    estimatedROI: roi,
    marginSensitivity: marginSensitive,
    salesVelocity30d: primary?.salesSignal ? safeDiv(primary.salesSignal, 30) : null,
    stockCoverageDays: coverageDays,
    inventoryVelocityScore: velocityScore,
    overstockRisk: overstock,
    restockNeed: restock,
    cannibalizationRisk: cannibalization,
    strategicRestockScore: strategicRestock,
    finalMatchScore: matchScore,
    discoverOpportunityScore: discoverScore,
    stockActionScore: stockAction,
    stockProtectionScore: stockProtection,
    revenueOpportunityScore: revenueScore,
    sourceReliability: reliability,
    fieldCompleteness: completeness,
    confidence: confidenceScore,
    fallbackPenalty: 0,
    failedSourcePenalty: sourcePenalty
  };

  return PreliminaryMetricsSchema.parse({
    estimatedMargin,
    demandSignal,
    pricePressure,
    supplierGap,
    inventoryRisk,
    trendMomentum: trendMomentumScore,
    opportunityScoreBase,
    productCount: products.length,
    evidenceCount,
    canonicalMetrics
  });
}
