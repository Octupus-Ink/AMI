import { randomUUID } from "node:crypto";
import type { MarketContextPayload, NormalizedProduct } from "@/lib/schemas/ami";
import { NormalizedProductSchema } from "@/lib/schemas/ami";
import type { EvidenceRef } from "@/lib/schemas/agents";
import { EvidenceRefSchema } from "@/lib/schemas/agents";
import type { BrightDataPayloadContext, BrightDataProduct } from "@/lib/data-providers/brightdata/types";

const PRODUCT_ARRAY_KEYS = ["products", "results", "items", "data", "records", "organic", "shopping_results"];
const PRICE_KEYS = ["price", "price_usd", "currentPrice", "current_price", "final_price", "sale_price", "value"];
const TITLE_KEYS = ["title", "name", "product_title", "productName", "product_name"];
const URL_KEYS = ["url", "link", "product_url", "sourceUrl"];
const RATING_KEYS = ["rating", "stars", "average_rating"];
const REVIEWS_KEYS = ["reviews", "reviewsCount", "reviews_count", "ratings_count"];

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

function truncateSnippet(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 320);
}

function evidenceForProduct(
  record: Record<string, unknown>,
  product: BrightDataProduct,
  context: MarketContextPayload,
  collectedAt: string
): EvidenceRef {
  const title = findString(record, TITLE_KEYS) ?? context.productName;
  const url = findString(record, URL_KEYS);
  const snippetSource =
    findString(record, ["description", "snippet", "text", "about"]) ??
    `${title} observed through ${product} for ${context.targetMarketplace}.`;

  return EvidenceRefSchema.parse({
    id: `evidence_${randomUUID()}`,
    source: context.targetMarketplace,
    sourceType: product,
    label: title,
    url,
    snippet: truncateSnippet(snippetSource),
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
  const price = findNumber(record, PRICE_KEYS);
  const rating = findNumber(record, RATING_KEYS);
  const reviewsCount = findNumber(record, REVIEWS_KEYS);
  const supplierPrice = findNumber(record, ["supplierPrice", "supplier_price", "unit_cost", "cost"]);
  const estimatedSupplierPrice = supplierPrice ?? (price ? Number((price * 0.58).toFixed(2)) : undefined);
  const estimatedMargin =
    price && estimatedSupplierPrice ? Number((((price - estimatedSupplierPrice) / price) * 100).toFixed(1)) : undefined;
  const demandSignal = signalFromText(`${title} ${evidenceRef.snippet ?? ""}`, reviewsCount ? clamp(42 + reviewsCount / 25) : 56);
  const pricePressure = price ? clamp(price < 25 ? 70 : price < 40 ? 58 : 44) : 52;
  const trendMomentum = clamp((demandSignal + (rating ? rating * 14 : 56)) / 2);
  const inventoryRisk = clamp(100 - (estimatedMargin ?? 38));

  return NormalizedProductSchema.parse({
    source: product,
    externalId: findString(record, ["asin", "sku", "id", "product_id"]) ?? `${product.toLowerCase().replace(/\s+/g, "_")}_${index + 1}`,
    title,
    canonicalTitle: canonicalize(title),
    category: findString(record, ["category", "department"]) ?? context.category,
    price,
    currency: context.currency,
    priceUsd: context.currency === "USD" ? price : price,
    originalPriceUsd: findNumber(record, ["originalPrice", "original_price", "list_price"]),
    rating,
    reviewsCount: reviewsCount ? Math.round(reviewsCount) : undefined,
    availability: findString(record, ["availability", "stockStatus", "stock_status"]) ?? "unknown",
    imageUrl: findString(record, ["image", "imageUrl", "image_url", "thumbnail"]),
    supplierName: findString(record, ["supplier", "seller", "merchant"]) ?? context.supplierSource,
    supplierPrice: estimatedSupplierPrice,
    estimatedDeliveryTime: findString(record, ["delivery", "deliveryEstimate", "shipping_time"]) ?? "Validation required",
    deliveryCostNote: findString(record, ["shipping", "delivery_cost", "deliveryCostNote"]),
    matchConfidence: title.toLowerCase().includes(context.productName.toLowerCase().split(" ")[0]) ? 0.82 : 0.58,
    demandSignal,
    pricePressure,
    trendMomentum,
    inventoryRisk,
    estimatedMargin,
    riskScore: clamp((pricePressure + inventoryRisk) / 2),
    confidence: rating && reviewsCount ? 0.82 : 0.66,
    lastUpdated: collectedAt,
    evidenceRefs: [evidenceRef.id]
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
  const products = Array.from({ length: Math.min(maxResults, 5) }, (_, index) => {
    const price = Number((basePrice + index * 2.25).toFixed(2));
    const supplierPrice = Number((price * (0.54 + index * 0.02)).toFixed(2));
    const evidence = EvidenceRefSchema.parse({
      id: `fallback_evidence_${index + 1}`,
      source: context.targetMarketplace,
      sourceType: "demo_snapshot",
      label: `${context.productName} fallback signal ${index + 1}`,
      snippet: `${context.productName} deterministic fallback evidence used because ${reason}.`,
      collectedAt,
      provider: "demo_fallback",
      product: "Bright Data fallback"
    });
    const estimatedMargin = Number((((price - supplierPrice) / price) * 100).toFixed(1));
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
        category: context.category,
        price,
        currency: context.currency,
        priceUsd: price,
        originalPriceUsd: Number((price * 1.12).toFixed(2)),
        rating: Number((4.6 - index * 0.08).toFixed(1)),
        reviewsCount: 420 - index * 55,
        availability: index === 4 ? "limited" : "in_stock",
        supplierName: context.supplierSource,
        supplierPrice,
        estimatedDeliveryTime: index > 2 ? "14-21 days" : "8-12 days",
        deliveryCostNote: "Delivery cost requires supplier validation",
        matchConfidence: index > 2 ? 0.68 : 0.84,
        demandSignal,
        pricePressure,
        trendMomentum,
        inventoryRisk,
        estimatedMargin,
        riskScore: clamp((pricePressure + inventoryRisk) / 2),
        confidence: index > 2 ? 0.62 : 0.78,
        lastUpdated: collectedAt,
        evidenceRefs: [evidence.id]
      })
    };
  });

  return {
    products: products.map((entry) => entry.product),
    evidenceRefs: products.map((entry) => entry.evidence)
  };
}
