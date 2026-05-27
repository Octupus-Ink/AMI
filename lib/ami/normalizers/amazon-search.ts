import type { Types } from "mongoose";

export type AmazonSearchRawRecord = {
  asin?: string | null;
  url?: string | null;
  name?: string | null;
  title?: string | null;
  brand?: string | null;
  initial_price?: number | null;
  final_price?: number | null;
  currency?: string | null;
  sold?: number | null;
  rating?: number | null;
  num_ratings?: number | null;
  reviews_count?: number | null;
  keyword?: string | null;
  image?: string | null;
  image_url?: string | null;
  bought_past_month?: number | null;
  rank_on_page?: number | null;
  sponsored?: string | boolean | null;
  is_prime?: boolean | null;
  is_coupon?: boolean | null;
  total_results?: number | null;
  timestamp?: string | null;
  input?: Record<string, unknown> | null;
};

export type NormalizedAmazonSearchProduct = {
  runId: Types.ObjectId;
  rawRef: Types.ObjectId;
  source: "amazon";
  externalId: string;
  sourceUrl: string;
  canonicalTitle: string;
  brand: string | null;
  category: string | null;
  keyword: string;
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
    isPrime: boolean;
    isCoupon: boolean;
    totalResults: number | null;
  };
  media: {
    imageUrl: string;
  };
  dataQuality: {
    hasPrice: boolean;
    hasRating: boolean;
    hasDemandSignal: boolean;
    hasImage: boolean;
  };
};

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = toNumber(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return false;
}

export function normalizeAmazonSearchRecord(
  record: AmazonSearchRawRecord,
  runId: Types.ObjectId,
  rawRef: Types.ObjectId
): NormalizedAmazonSearchProduct | null {
  const title = record.name || record.title || "";
  const sourceUrl = record.url || "";

  if (!title || !sourceUrl) {
    return null;
  }

  const currentPrice = toNullableNumber(record.final_price);
  const originalPrice = toNullableNumber(record.initial_price);
  const rating = toNullableNumber(record.rating);
  const reviewsCount = toNumber(record.num_ratings ?? record.reviews_count, 0);
  const boughtPastMonth = toNumber(
    record.bought_past_month ?? record.sold,
    0
  );
  const rankOnPage = toNullableNumber(record.rank_on_page);
  const imageUrl = record.image || record.image_url || "";

  return {
    runId,
    rawRef,
    source: "amazon",
    externalId: record.asin || sourceUrl,
    sourceUrl,
    canonicalTitle: title.trim(),
    brand: record.brand || null,
    category: null,
    keyword: record.keyword || "",
    price: {
      current: currentPrice,
      original: originalPrice,
      currency: record.currency || "USD",
    },
    marketSignals: {
      rating,
      reviewsCount,
      boughtPastMonth,
      rankOnPage,
      sponsored: toBoolean(record.sponsored),
      isPrime: toBoolean(record.is_prime),
      isCoupon: toBoolean(record.is_coupon),
      totalResults: toNullableNumber(record.total_results),
    },
    media: {
      imageUrl,
    },
    dataQuality: {
      hasPrice: currentPrice !== null,
      hasRating: rating !== null,
      hasDemandSignal: boughtPastMonth > 0 || reviewsCount > 0,
      hasImage: Boolean(imageUrl),
    },
  };
}
