import { randomUUID } from "node:crypto";
import type { MarketContextPayload, NormalizedProduct } from "@/lib/schemas/ami";
import { NormalizedProductSchema } from "@/lib/schemas/ami";
import type { EvidenceRef } from "@/lib/schemas/agents";
import { EvidenceRefSchema } from "@/lib/schemas/agents";
import { sanitizeEvidenceSnippet, sanitizeEvidenceTitle, toHttpSourceUrl } from "@/lib/analysis/source-state";
import type { BrightDataPayloadContext, BrightDataProduct } from "@/lib/data-providers/brightdata/types";

const PRODUCT_ARRAY_KEYS = ["products", "results", "items", "data", "records", "organic", "shopping_results"];
const PRICE_KEYS = ["final_price", "buybox_final_price", "sale_price", "price", "price_usd", "currentPrice", "current_price", "initial_price", "value"];
const TITLE_KEYS = ["title", "name", "product_title", "productName", "product_name", "item_title"];
const URL_KEYS = [
  "url",
  "link",
  "href",
  "sourceUrl",
  "source_url",
  "productUrl",
  "product_url",
  "canonicalUrl",
  "canonical_url",
  "itemUrl",
  "item_url",
  "listingUrl",
  "listing_url",
  "marketplaceUrl",
  "marketplace_url",
  "externalUrl",
  "external_url",
  "evidenceUrl",
  "evidence_url",
  "sourceHref",
  "source_href",
  "postUrl",
  "post_url",
  "profileUrl",
  "profile_url"
];
const SUPPLIER_URL_KEYS = [
  "supplierUrl",
  "supplier_url",
  "sellerUrl",
  "seller_url",
  "shopUrl",
  "shop_url",
  "storeUrl",
  "store_url",
  "merchantUrl",
  "merchant_url",
  "vendorUrl",
  "vendor_url",
  "profileUrl",
  "profile_url"
];
const EXTERNAL_ID_KEYS = ["asin", "sku", "id", "product_id", "productId", "item_id", "itemId", "external_id", "externalId"];
const RATING_KEYS = ["rating", "stars", "average_rating"];
const REVIEWS_KEYS = ["reviews_count", "num_ratings", "numRatings", "item_reviews", "reviews", "reviewsCount", "ratings_count", "review_count"];
const AMAZON_ASIN_PATTERN = /^[A-Z0-9]{10}$/i;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function findString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function resolveAmazonProductUrl(record: Record<string, unknown>, context: MarketContextPayload) {
  const marketplaceText = `${context.targetMarketplace} ${context.region}`.toLowerCase();

  if (!marketplaceText.includes("amazon")) {
    return null;
  }

  const asin = findString(record, ["asin", "ASIN"]);

  if (!asin || !AMAZON_ASIN_PATTERN.test(asin)) {
    return null;
  }

  return `https://www.amazon.com/dp/${asin.toUpperCase()}`;
}

function resolveSourceUrl(record: Record<string, unknown>, context: MarketContextPayload) {
  return toHttpSourceUrl(findString(record, URL_KEYS)) ?? resolveAmazonProductUrl(record, context);
}

function resolveSupplierUrl(record: Record<string, unknown>) {
  return toHttpSourceUrl(findString(record, SUPPLIER_URL_KEYS));
}

function isSupplierMarketplaceSignal(...values: Array<string | null | undefined>) {
  return values
    .filter((value): value is string => Boolean(value?.trim()))
    .some((value) => /alibaba|aliexpress|1688\.com|dhgate|made-in-china|globalsources|indiamart/i.test(value));
}

function findNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = Number(value.replace(/[^0-9.-]/g, ""));

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return undefined;
}

function findNestedRecord(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function findProductDetailString(record: Record<string, unknown>, parentKeys: string[], childKey: string) {
  for (const parentKey of parentKeys) {
    const rawParent = record[parentKey];

    // Array of { type, value } entries (Bright Data product-detail format)
    if (Array.isArray(rawParent)) {
      for (const entry of rawParent) {
        const entryRecord = asRecord(entry);
        if (
          entryRecord &&
          typeof entryRecord.type === "string" &&
          entryRecord.type.trim().toLowerCase() === childKey.trim().toLowerCase() &&
          typeof entryRecord.value === "string" &&
          entryRecord.value.trim()
        ) {
          return entryRecord.value.trim();
        }
      }
      continue;
    }

    // Plain object form
    const parent = findNestedRecord(record, parentKey);
    const candidate = parent?.[childKey];

    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return undefined;
}

function parseNumberFromText(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const multiplier = /\bk\b/i.test(value) ? 1000 : /\bm\b/i.test(value) ? 1_000_000 : 1;
  const match = value.replace(/,/g, "").match(/-?\d+(\.\d+)?/);

  if (!match) {
    return undefined;
  }

  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed * multiplier : undefined;
}

function resolvePrice(record: Record<string, unknown>) {
  const buyboxPrices = findNestedRecord(record, "buybox_prices");
  return (
    findNumber(record, ["finalPrice", "final_price"]) ??
    (buyboxPrices ? findNumber(buyboxPrices, ["finalPrice", "final_price", "price", "initialPrice", "initial_price"]) : undefined) ??
    findNumber(record, ["sale_price"]) ??
    parseNumberFromText(record.price) ??
    findNumber(record, ["priceUsd", "price_usd", "initialPrice", "initial_price"])
  );
}

function resolveReviews(record: Record<string, unknown>) {
  return (
    findNumber(record, REVIEWS_KEYS) ??
    parseNumberFromText(findProductDetailString(record, ["product_details"], "Customer Reviews")) ??
    undefined
  );
}

function resolveSalesSignal(record: Record<string, unknown>) {
  return findNumber(record, ["boughtPastMonth", "bought_past_month", "sold"]) ?? parseNumberFromText(record.sold_count);
}

function resolveAvailability(record: Record<string, unknown>, price: number | undefined) {
  if (record.is_available === true) {
    return "in_stock";
  }

  if (record.is_available === false) {
    return "unavailable";
  }

  const rawAvailability = findString(record, ["availability", "stockStatus", "stock_status"]);
  const lowerAvailability = rawAvailability?.toLowerCase() ?? "";
  const availableCount = findNumber(record, ["available_count"]);

  if (lowerAvailability.includes("in stock")) {
    return "in_stock";
  }

  if (lowerAvailability.includes("currently unavailable") || lowerAvailability.includes("out of stock")) {
    return "unavailable";
  }

  if (availableCount !== undefined && availableCount > 0) {
    return "in_stock";
  }

  if (rawAvailability?.toLowerCase().includes("limited")) {
    return "limited";
  }

  const deliveryStr = Array.isArray(record.delivery) ? record.delivery[0] : undefined;
  if ((deliveryStr ?? findString(record, ["delivery", "deliveryEstimate", "shipping_time"])) && price !== undefined) {
    return "likely_available";
  }

  return "unknown";
}

function parseDays(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const lower = value.toLowerCase();
  const range = lower.match(/(\d+)\s*[-–]\s*(\d+)\s*day/);

  if (range) {
    return Number(range[2]);
  }

  const single = lower.match(/(\d+)\s*day/);

  if (single) {
    return Number(single[1]);
  }

  return undefined;
}

function resolveDeliveryDays(record: Record<string, unknown>) {
  const deliveryValue = Array.isArray(record.delivery) ? record.delivery[0] : record.delivery;
  return (
    parseDays(deliveryValue) ??
    parseDays(record.availability_date) ??
    parseDays(record.ships_to) ??
    parseDays(record.estimatedDeliveryDays) ??
    parseDays(record.estimatedDeliveryTime) ??
    parseDays(record.deliveryEstimate) ??
    parseDays(record.shipping_time)
  );
}

function inferBrandFromTitle(title: string) {
  const firstToken = title.split(/\s+/).find((part) => /^[A-Z][A-Za-z0-9-]{2,}$/.test(part));
  return firstToken;
}

function resolveBrand(record: Record<string, unknown>, title: string) {
  const nestedBrand =
    findProductDetailString(record, ["product_details"], "Brand") ??
    findProductDetailString(record, ["product_specifications"], "Brand");
  const direct = findString(record, ["brand", "manufacturer"]) ?? nestedBrand;

  if (direct) {
    return { brand: direct, brandConfidence: "high" as const };
  }

  const inferred = inferBrandFromTitle(title);

  if (inferred) {
    return { brand: inferred, brandConfidence: "low" as const };
  }

  return { brand: "Unknown", brandConfidence: "unknown" as const };
}

function resolveCategoryPath(record: Record<string, unknown>, context: MarketContextPayload) {
  const directCategories = record.categories;

  if (Array.isArray(directCategories)) {
    return directCategories.map((item) => (typeof item === "string" ? item : JSON.stringify(item))).filter(Boolean);
  }

  for (const key of ["categories_with_urls", "category_tree", "breadcrumbs"]) {
    const value = record[key];

    if (Array.isArray(value)) {
      const names = value
        .map((item) => {
          const nested = asRecord(item);
          return nested ? findString(nested, ["category_name", "name"]) : typeof item === "string" ? item : undefined;
        })
        .filter((item): item is string => Boolean(item));

      if (names.length) {
        return names;
      }
    }
  }

  const discoveryInput = findNestedRecord(record, "discovery_input") ?? findNestedRecord(record, "input");
  const keyword =
    findString(record, ["keyword"]) ??
    (discoveryInput ? findString(discoveryInput, ["keyword"]) : undefined) ??
    context.category;
  return keyword ? [keyword] : ["unknown"];
}

function flattenCandidateArrays(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenCandidateArrays(item));
  }

  const record = asRecord(value);

  if (!record) {
    return [];
  }

  const directTitle = findString(record, TITLE_KEYS);

  if (directTitle) {
    return [record];
  }

  for (const key of PRODUCT_ARRAY_KEYS) {
    const nested = record[key];
    const candidates = flattenCandidateArrays(nested);

    if (candidates.length) {
      return candidates;
    }
  }

  return [];
}

function canonicalize(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function signalFromText(text: string, fallback: number) {
  const lower = text.toLowerCase();

  if (lower.includes("best seller") || lower.includes("trending") || lower.includes("popular")) {
    return Math.max(fallback, 76);
  }

  if (lower.includes("sponsored") || lower.includes("deal") || lower.includes("discount")) {
    return Math.max(fallback, 63);
  }

  return fallback;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function evidenceForProduct(
  record: Record<string, unknown>,
  product: BrightDataProduct,
  context: MarketContextPayload,
  collectedAt: string
): EvidenceRef {
  const title = sanitizeEvidenceTitle(findString(record, TITLE_KEYS), context.productName);
  const url = resolveSourceUrl(record, context);
  const snippetSource =
    findString(record, ["description", "snippet", "text", "about"]) ??
    `${title} observed through ${product} for ${context.targetMarketplace}.`;
  const snippet = sanitizeEvidenceSnippet(snippetSource) ?? `${title} observed through ${product}.`;

  return EvidenceRefSchema.parse({
    id: `evidence_${randomUUID()}`,
    source: context.targetMarketplace,
    sourceType: product,
    label: title,
    ...(url ? { url } : {}),
    snippet,
    collectedAt,
    provider: "brightdata",
    product
  });
}

function normalizeRecord(
  record: Record<string, unknown>,
  evidenceRef: EvidenceRef,
  payloadContext: BrightDataPayloadContext,
  index: number
): NormalizedProduct {
  const { context, product, collectedAt } = payloadContext;
  const title = findString(record, TITLE_KEYS) ?? `${context.productName} ${index + 1}`;
  const price = resolvePrice(record) ?? findNumber(record, PRICE_KEYS);
  const rating = findNumber(record, RATING_KEYS);
  const reviewsCount = resolveReviews(record);
  const salesSignal = resolveSalesSignal(record);
  const sourceUrl = evidenceRef.url;
  const supplierUrl = resolveSupplierUrl(record);
  const supplierPrice = findNumber(record, ["supplierPrice", "supplier_price", "unit_cost", "cost"]);
  const sourceIsSupplierMarketplace = isSupplierMarketplaceSignal(
    sourceUrl,
    supplierUrl,
    findString(record, ["source", "sourceName", "source_name", "marketplace", "platform"]),
    context.targetMarketplace
  );
  const supplierUnitCost = supplierPrice ?? (sourceIsSupplierMarketplace ? price : undefined);
  const estimatedMargin =
    price && supplierUnitCost && !sourceIsSupplierMarketplace ? Number((((price - supplierUnitCost) / price) * 100).toFixed(1)) : undefined;
  const isSponsored =
    record.sponsored === true ||
    record.sponsored === "true" ||
    record.sponsered === true ||
    record.sponsered === "true";
  const demandFallback = salesSignal ? clamp(45 + salesSignal / 100) : reviewsCount ? clamp(42 + reviewsCount / 25) : 56;
  const demandSignal = signalFromText(`${title} ${isSponsored ? "sponsored" : ""} ${evidenceRef.snippet ?? ""}`, demandFallback);
  const pricePressure = price ? clamp(price < 25 ? 70 : price < 40 ? 58 : 44) : undefined;
  const trendMomentum = clamp((demandSignal + (rating ? rating * 14 : 56)) / 2);
  const inventoryRisk = clamp(100 - (estimatedMargin ?? 38));
  const availability = resolveAvailability(record, price);
  const estimatedDeliveryDays = resolveDeliveryDays(record) ?? null;
  const { brand, brandConfidence } = resolveBrand(record, title);
  const categoryPath = resolveCategoryPath(record, context);
  const supplierName = findString(record, ["supplier", "seller", "merchant", "seller_name", "shop_name"]);
  const missingFields = [
    price === undefined ? "price" : "",
    supplierUnitCost === undefined ? "supplierPrice" : "",
    reviewsCount === undefined ? "reviewsCount" : "",
    salesSignal === undefined ? "salesSignal" : "",
    estimatedDeliveryDays === null ? "estimatedDeliveryDays" : ""
  ].filter(Boolean);

  return NormalizedProductSchema.parse({
    source: product,
    externalId: findString(record, EXTERNAL_ID_KEYS) ?? `${product.toLowerCase().replace(/\s+/g, "_")}_${index + 1}`,
    ...(sourceUrl ? { sourceUrl, productUrl: sourceUrl, marketplaceUrl: sourceUrl } : {}),
    ...(supplierUrl ? { supplierUrl } : {}),
    lastSeenAt: collectedAt,
    title,
    canonicalTitle: canonicalize(title),
    brand,
    brandConfidence,
    category: findString(record, ["category", "department"]) ?? categoryPath[0] ?? context.category,
    categoryPath,
    price,
    priceDataStatus: price === undefined ? "missing" : "available",
    currency: context.currency,
    priceUsd: context.currency === "USD" ? price : price,
    originalPriceUsd: findNumber(record, ["originalPrice", "original_price", "list_price"]),
    rating,
    reviewsCount: reviewsCount ? Math.round(reviewsCount) : undefined,
    salesSignal,
    availability,
    estimatedDeliveryDays,
    imageUrl: findString(record, ["image_url", "image", "imageUrl", "thumbnail", "main_image"]),
    ...(supplierName ? { supplierName } : {}),
    ...(supplierUnitCost !== undefined ? { supplierPrice: supplierUnitCost } : {}),
    estimatedDeliveryTime: (Array.isArray(record.delivery) ? (record.delivery as string[]).join(" | ") : undefined) ?? findString(record, ["delivery", "deliveryEstimate", "shipping_time"]),
    deliveryCostNote: findString(record, ["shipping", "delivery_cost", "deliveryCostNote"]),
    matchConfidence: title.toLowerCase().includes(context.productName.toLowerCase().split(" ")[0]) ? 0.82 : 0.58,
    demandSignal,
    pricePressure,
    trendMomentum,
    inventoryRisk,
    estimatedMargin,
    riskScore: clamp(((pricePressure ?? 50) + inventoryRisk) / 2),
    confidence: rating && reviewsCount ? 0.82 : 0.66,
    lastUpdated: collectedAt,
    evidenceRefs: [evidenceRef.id],
    dataQuality: {
      missingFields,
      fallbackFields: price === undefined || supplierUnitCost === undefined ? ["missing_cost_no_margin_roi"] : [],
      sourceStatus: missingFields.length ? "partial" : "success"
    }
  });
}

export function normalizeBrightDataPayload(payload: unknown, payloadContext: BrightDataPayloadContext) {
  const candidates = flattenCandidateArrays(payload).slice(0, payloadContext.maxResults);
  const evidenceRefs: EvidenceRef[] = [];
  const products: NormalizedProduct[] = [];

  candidates.forEach((candidate, index) => {
    const evidence = evidenceForProduct(candidate, payloadContext.product, payloadContext.context, payloadContext.collectedAt);
    evidenceRefs.push(evidence);
    products.push(normalizeRecord(candidate, evidence, payloadContext, index));
  });

  return { products, evidenceRefs };
}

export function createFallbackProducts(context: MarketContextPayload, collectedAt: string, maxResults: number, reason: string) {
  const basePrice = context.businessGoal === "stock_optimization" ? 34.99 : 29.99;
  const fallbackReason = reason.replace(/\.+$/g, "");
  const products = Array.from({ length: Math.min(maxResults, 5) }, (_, index) => {
    const price = Number((basePrice + index * 2.25).toFixed(2));
    const evidence = EvidenceRefSchema.parse({
      id: `fallback_evidence_${index + 1}`,
      source: context.targetMarketplace,
      sourceType: "demo_fallback",
      label: `${context.productName} fallback signal ${index + 1}`,
      snippet: `${context.productName} deterministic fallback evidence used because ${fallbackReason}.`,
      collectedAt,
      provider: "demo_fallback",
      product: "Bright Data fallback"
    });
    const demandSignal = clamp(70 - index * 4);
    const pricePressure = clamp(62 + index * 3);
    const trendMomentum = clamp(68 - index * 2);
    const inventoryRisk = clamp(42 + index * 5);

    return {
      evidence,
      product: NormalizedProductSchema.parse({
        source: "Bright Data demo fallback",
        externalId: `demo_${index + 1}`,
        title: index === 0 ? context.productName : `${context.productName} variant ${index + 1}`,
        canonicalTitle: canonicalize(index === 0 ? context.productName : `${context.productName} variant ${index + 1}`),
        brand: "Unknown",
        brandConfidence: "unknown",
        category: context.category,
        categoryPath: [context.category],
        price,
        priceDataStatus: "available",
        currency: context.currency,
        priceUsd: price,
        originalPriceUsd: Number((price * 1.12).toFixed(2)),
        rating: Number((4.6 - index * 0.08).toFixed(1)),
        reviewsCount: 420 - index * 55,
        salesSignal: 250 - index * 20,
        availability: index === 4 ? "limited" : "in_stock",
        estimatedDeliveryDays: null,
        estimatedDeliveryTime: "Supplier validation required",
        deliveryCostNote: "Delivery cost requires supplier validation",
        matchConfidence: index > 2 ? 0.68 : 0.84,
        demandSignal,
        pricePressure,
        trendMomentum,
        inventoryRisk,
        riskScore: clamp((pricePressure + inventoryRisk) / 2),
        confidence: index > 2 ? 0.62 : 0.78,
        lastSeenAt: collectedAt,
        lastUpdated: collectedAt,
        evidenceRefs: [evidence.id],
        dataQuality: {
          missingFields: ["supplierPrice", "estimatedDeliveryDays"],
          fallbackFields: ["deterministic_demo_seed", "missing_cost_no_margin_roi"],
          sourceStatus: "partial"
        }
      })
    };
  });

  return {
    products: products.map((entry) => entry.product),
    evidenceRefs: products.map((entry) => entry.evidence)
  };
}
