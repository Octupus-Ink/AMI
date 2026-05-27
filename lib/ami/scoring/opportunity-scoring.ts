type NormalizedProductForScoring = {
  canonicalTitle: string;
  sourceUrl: string;
  keyword?: string;
  price: {
    current: number | null;
    original: number | null;
    currency: string;
  };
  marketSignals: {
    rating: number | null;
    reviewsCount: number;
    boughtPastMonth: number;
    rankOnPage: number | null;
    sponsored: boolean;
  };
  media: {
    imageUrl: string;
  };
};

export type OpportunityScoringResult = {
  demandScore: number;
  priceSignal: number;
  confidenceScore: number;
  riskScore: number;
  opportunityScore: number;
  action: string;
  reasoningSummary: string;
  nextStep: string;
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function scoreOpportunity(
  product: NormalizedProductForScoring
): OpportunityScoringResult {
  const rating = product.marketSignals.rating ?? 0;
  const reviews = product.marketSignals.reviewsCount ?? 0;
  const boughtPastMonth = product.marketSignals.boughtPastMonth ?? 0;
  const rankOnPage = product.marketSignals.rankOnPage ?? 99;
  const hasPrice = product.price.current !== null;
  const isSponsored = product.marketSignals.sponsored;

  let demandScore = 0;

  if (boughtPastMonth >= 10000) demandScore += 45;
  else if (boughtPastMonth >= 5000) demandScore += 38;
  else if (boughtPastMonth >= 1000) demandScore += 30;
  else if (boughtPastMonth >= 500) demandScore += 22;
  else if (boughtPastMonth >= 100) demandScore += 14;
  else if (boughtPastMonth > 0) demandScore += 8;

  if (reviews >= 1000) demandScore += 25;
  else if (reviews >= 500) demandScore += 20;
  else if (reviews >= 100) demandScore += 15;
  else if (reviews >= 25) demandScore += 10;
  else if (reviews > 0) demandScore += 5;

  if (rating >= 4.6) demandScore += 20;
  else if (rating >= 4.3) demandScore += 16;
  else if (rating >= 4.0) demandScore += 10;
  else if (rating > 0) demandScore += 4;

  if (rankOnPage <= 3) demandScore += 10;
  else if (rankOnPage <= 8) demandScore += 7;
  else if (rankOnPage <= 16) demandScore += 4;

  demandScore = clamp(demandScore);

  let priceSignal = 50;

  if (hasPrice) {
    const current = product.price.current || 0;
    if (current > 0 && current <= 25) priceSignal += 20;
    else if (current <= 50) priceSignal += 15;
    else if (current <= 100) priceSignal += 8;
    else if (current > 500) priceSignal -= 10;

    if (
      product.price.original &&
      product.price.original > current &&
      current > 0
    ) {
      const discountPct =
        ((product.price.original - current) / product.price.original) * 100;
      if (discountPct >= 30) priceSignal += 12;
      else if (discountPct >= 15) priceSignal += 8;
      else if (discountPct >= 5) priceSignal += 4;
    }
  } else {
    priceSignal -= 30;
  }

  priceSignal = clamp(priceSignal);

  let confidenceScore = 50;

  if (hasPrice) confidenceScore += 15;
  if (rating >= 4.0) confidenceScore += 12;
  if (reviews >= 100) confidenceScore += 12;
  if (boughtPastMonth >= 500) confidenceScore += 14;
  if (product.media.imageUrl) confidenceScore += 5;
  if (isSponsored) confidenceScore -= 12;
  if (!hasPrice) confidenceScore -= 20;

  confidenceScore = clamp(confidenceScore);

  let riskScore = 25;

  if (!hasPrice) riskScore += 25;
  if (rating > 0 && rating < 4.0) riskScore += 18;
  if (reviews < 25) riskScore += 10;
  if (isSponsored) riskScore += 8;
  if (boughtPastMonth === 0) riskScore += 8;
  if (rating >= 4.5 && reviews >= 100) riskScore -= 10;

  riskScore = clamp(riskScore);

  const opportunityScore = clamp(
    demandScore * 0.45 +
      priceSignal * 0.2 +
      confidenceScore * 0.25 +
      (100 - riskScore) * 0.1
  );

  let action = "Monitor this product";
  if (opportunityScore >= 80) action = "Prioritize for sourcing review";
  else if (opportunityScore >= 65) action = "Evaluate supplier options";
  else if (opportunityScore >= 50) action = "Keep as secondary opportunity";

  const reasoningSummary = [
    `Demand score ${demandScore}/100 based on Amazon rating, reviews, purchase velocity, and search rank.`,
    `Confidence score ${confidenceScore}/100 based on data completeness and signal quality.`,
    `Risk score ${riskScore}/100 based on missing data, sponsorship, weak rating, or low validation.`,
  ].join(" ");

  const nextStep =
    opportunityScore >= 65
      ? "Validate supplier availability, delivery time, and margin before committing."
      : "Keep this product in the watchlist and compare against stronger opportunities.";

  return {
    demandScore,
    priceSignal,
    confidenceScore,
    riskScore,
    opportunityScore,
    action,
    reasoningSummary,
    nextStep,
  };
}
