import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { MarketContextPayload } from "@/lib/schemas/ami";
import type { EvidenceRef } from "@/lib/schemas/agents";
import type { NormalizedProduct } from "@/lib/schemas/ami";
import { sanitizeEvidenceSnippet } from "@/lib/analysis/source-state";
import { createFallbackProducts, normalizeBrightDataPayload } from "@/lib/data-providers/brightdata/normalize";
import {
  buildMarketplaceSearchUrl,
  classifyBrightDataInput,
  marketplaceKeyForContext,
  resolveBrightDataOperation,
  scraperRequestEndpoint
} from "@/lib/data-providers/brightdata/registry";
import type {
  BrightDataAttempt,
  BrightDataCollectionResult,
  BrightDataConfig,
  BrightDataProduct
} from "@/lib/data-providers/brightdata/types";

type BrightDataAttemptResult = {
  attempt: BrightDataAttempt;
  products?: NormalizedProduct[];
  evidenceRefs?: EvidenceRef[];
};

type FallbackSnapshot = {
  ref: string;
  sourceName: string;
  sourceType: string;
  product: BrightDataProduct;
  products: NormalizedProduct[];
  evidenceRefs: EvidenceRef[];
};

const FALLBACK_RAW_SNAPSHOTS = [
  {
    marketplace: "amazon",
    ref: "data/brightdata/raw/amazon/search/2026-05-27-amazon-products-search.raw.json",
    pathSegments: ["amazon", "search", "2026-05-27-amazon-products-search.raw.json"],
    sourceName: "Amazon Products Search",
    sourceType: "amazon_products_search",
    product: "Web Scraper API" as BrightDataProduct
  },
  {
    marketplace: "ebay",
    ref: "data/brightdata/raw/ebay/product-detail/2026-05-27-ebay-product-detail-sample.raw.json",
    pathSegments: ["ebay", "product-detail", "2026-05-27-ebay-product-detail-sample.raw.json"],
    sourceName: "eBay Product URL",
    sourceType: "ebay_product_url",
    product: "Web Scraper API" as BrightDataProduct
  }
];

function readBoolean(value: string | undefined, fallback: boolean) {
  if (!value) {
    return fallback;
  }

  return value.toLowerCase() === "true";
}

function readInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function capResults(value: number) {
  return Math.max(1, Math.min(5, value));
}

export function getBrightDataConfig(): BrightDataConfig {
  return {
    apiKey: process.env.BRIGHT_DATA_API_KEY?.trim(),
    useLiveWeb: readBoolean(process.env.AMI_USE_LIVE_WEB, true),
    allowFallback: readBoolean(process.env.AMI_ALLOW_DEMO_FALLBACK, true),
    webUnlockerEndpoint: process.env.BRIGHT_DATA_WEB_UNLOCKER_ENDPOINT?.trim(),
    webScraperEndpoint: process.env.BRIGHT_DATA_WEB_SCRAPER_ENDPOINT?.trim(),
    webScraperTriggerEndpoint: process.env.BRIGHT_DATA_WEB_SCRAPER_TRIGGER_ENDPOINT?.trim(),
    webScraperProgressEndpoint: process.env.BRIGHT_DATA_WEB_SCRAPER_PROGRESS_ENDPOINT?.trim(),
    serpEndpoint: process.env.BRIGHT_DATA_SERP_ENDPOINT?.trim(),
    discoverEndpoint: process.env.BRIGHT_DATA_DISCOVER_ENDPOINT?.trim(),
    webUnlockerZone: process.env.BRIGHT_DATA_WEB_UNLOCKER_ZONE?.trim() || process.env.BRIGHT_DATA_ZONE?.trim(),
    serpZone: process.env.BRIGHT_DATA_SERP_ZONE?.trim() || process.env.BRIGHT_DATA_ZONE?.trim(),
    defaultZone: process.env.BRIGHT_DATA_ZONE?.trim(),
    defaultCountry: process.env.BRIGHT_DATA_DEFAULT_COUNTRY?.trim() || "us",
    defaultFormat: process.env.BRIGHT_DATA_DEFAULT_FORMAT?.trim() || "raw",
    timeoutMs: readInt(process.env.BRIGHT_DATA_TIMEOUT_MS ?? process.env.AMI_WEB_REQUEST_TIMEOUT_MS, 30_000),
    maxResults: capResults(readInt(process.env.AMI_MAX_DISCOVERY_RESULTS ?? process.env.BRIGHT_DATA_MAX_REQUESTS_PER_ANALYSIS, 5)),
    amazonProductsDatasetId: process.env.BRIGHT_DATA_AMAZON_PRODUCTS_DATASET_ID?.trim(),
    amazonProductsDiscoverType: process.env.BRIGHT_DATA_AMAZON_PRODUCTS_DISCOVER_TYPE?.trim(),
    amazonProductsDiscoverBy: process.env.BRIGHT_DATA_AMAZON_PRODUCTS_DISCOVER_BY?.trim(),
    amazonProductsInputKey: process.env.BRIGHT_DATA_AMAZON_PRODUCTS_INPUT_KEY?.trim(),
    ebayDatasetId: process.env.BRIGHT_DATA_EBAY_DATASET_ID?.trim(),
    ebayKeywordDiscoverType: process.env.BRIGHT_DATA_EBAY_KEYWORD_DISCOVER_TYPE?.trim(),
    ebayKeywordDiscoverBy: process.env.BRIGHT_DATA_EBAY_KEYWORD_DISCOVER_BY?.trim(),
    ebayKeywordInputKey: process.env.BRIGHT_DATA_EBAY_KEYWORD_INPUT_KEY?.trim(),
    ebayCategoryInputKey: process.env.BRIGHT_DATA_EBAY_CATEGORY_INPUT_KEY?.trim(),
    ebayProductUrlInputKey: process.env.BRIGHT_DATA_EBAY_PRODUCT_URL_INPUT_KEY?.trim(),
    ebayShopUrlInputKey: process.env.BRIGHT_DATA_EBAY_SHOP_URL_INPUT_KEY?.trim(),
    alibabaProductsDatasetId: process.env.BRIGHT_DATA_ALIBABA_PRODUCTS_DATASET_ID?.trim(),
    aliexpressProductsDatasetId: process.env.BRIGHT_DATA_ALIEXPRESS_PRODUCTS_DATASET_ID?.trim(),
    tiktokShopProductsDatasetId: process.env.BRIGHT_DATA_TIKTOK_SHOP_PRODUCTS_DATASET_ID?.trim(),
    facebookMarketplaceDatasetId: process.env.BRIGHT_DATA_FACEBOOK_MARKETPLACE_DATASET_ID?.trim(),
    facebookMarketplaceEnabled: readBoolean(process.env.BRIGHT_DATA_FACEBOOK_MARKETPLACE_ENABLED, false),
    facebookMarketplaceDiscoverType: process.env.BRIGHT_DATA_FACEBOOK_MARKETPLACE_DISCOVER_TYPE?.trim(),
    facebookMarketplaceDiscoverBy: process.env.BRIGHT_DATA_FACEBOOK_MARKETPLACE_DISCOVER_BY?.trim(),
    facebookMarketplaceInputKey: process.env.BRIGHT_DATA_FACEBOOK_MARKETPLACE_INPUT_KEY?.trim(),
    facebookMarketplaceDefaultCity: process.env.BRIGHT_DATA_FACEBOOK_MARKETPLACE_DEFAULT_CITY?.trim(),
    facebookMarketplaceDefaultDateListed: process.env.BRIGHT_DATA_FACEBOOK_MARKETPLACE_DEFAULT_DATE_LISTED?.trim()
  };
}

export function validateBrightDataEnv(config = getBrightDataConfig()) {
  const missing: string[] = [];

  if (!config.apiKey) {
    missing.push("BRIGHT_DATA_API_KEY");
  }

  if (!config.webUnlockerEndpoint && !config.webScraperEndpoint) {
    missing.push("Bright Data endpoint");
  }

  return {
    configured: missing.length === 0,
    missing
  };
}

function safeError(error: unknown) {
  if (error instanceof Error) {
    return error.message.replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]");
  }

  return "Unknown Bright Data error";
}

function sourceNameForProduct(product: BrightDataProduct, context: MarketContextPayload) {
  const marketplace = marketplaceKeyForContext(context);

  if (product === "Web Scraper API" && marketplace === "amazon") {
    return "Amazon Products Search";
  }

  if (product === "Web Scraper API" && marketplace === "ebay") {
    return "eBay Products";
  }

  if (product === "Web Scraper API") {
    return "Marketplace Products Search";
  }

  if (product === "Web Unlocker") {
    return "Marketplace Search via Web Unlocker";
  }

  return "Marketplace SERP Search";
}

function hasLiveAttempt(attempts: BrightDataAttempt[]) {
  return attempts.some((attempt) => attempt.status === "success" || attempt.status === "partial" || attempt.status === "failed" || attempt.status === "empty");
}

function normalizedStatus(products: NormalizedProduct[]): "success" | "partial" {
  const missingCritical = products.some((product) => !product.priceUsd || !product.reviewsCount || !product.availability || product.priceDataStatus === "missing");
  return missingCritical ? "partial" : "success";
}

function loadFallbackSnapshot(context: MarketContextPayload, collectedAt: string, maxResults: number): FallbackSnapshot | null {
  const candidate = FALLBACK_RAW_SNAPSHOTS.find((snapshot) => snapshot.marketplace === marketplaceKeyForContext(context));

  if (!candidate) {
    return null;
  }

  const absolutePath = join(process.cwd(), "data", "brightdata", "raw", ...candidate.pathSegments);

  if (!existsSync(absolutePath)) {
    return null;
  }

  try {
    const payload = JSON.parse(readFileSync(absolutePath, "utf8")) as unknown;
    const normalized = normalizeBrightDataPayload(payload, {
      context,
      product: candidate.product,
      collectedAt,
      maxResults
    });

    if (!normalized.products.length || !normalized.evidenceRefs.length) {
      return null;
    }

    return {
      ref: candidate.ref,
      sourceName: candidate.sourceName,
      sourceType: candidate.sourceType,
      product: candidate.product,
      products: normalized.products,
      evidenceRefs: normalized.evidenceRefs
    };
  } catch {
    return null;
  }
}

async function requestJson(
  endpoint: string,
  apiKey: string,
  body: Record<string, unknown> | undefined,
  timeoutMs: number,
  method: "GET" | "POST" = "POST"
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      ...(method === "POST" && body ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal
    });

    const contentType = response.headers.get("content-type") ?? "";
    const payload = contentType.includes("application/json") ? await response.json() : await response.text();

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${typeof payload === "string" ? payload.slice(0, 160) : "Bright Data request failed"}`);
    }

    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function findSnapshotId(value: unknown): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = findSnapshotId(item);

      if (nested) {
        return nested;
      }
    }

    return undefined;
  }

  const record = value as Record<string, unknown>;

  for (const key of ["snapshot_id", "snapshotId", "snapshot", "id"]) {
    const candidate = record[key];

    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  for (const nested of Object.values(record)) {
    const nestedId = findSnapshotId(nested);

    if (nestedId) {
      return nestedId;
    }
  }

  return undefined;
}

async function pollSnapshotPayload(snapshotId: string, config: BrightDataConfig) {
  if (!config.webScraperProgressEndpoint) {
    return null;
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const url = new URL(config.webScraperProgressEndpoint);
    url.searchParams.set("snapshot_id", snapshotId);
    const payload = await requestJson(url.toString(), config.apiKey ?? "", undefined, config.timeoutMs, "GET");

    if (normalizeBrightDataPayload(payload, {
      context: {
        productName: "snapshot",
        category: "snapshot",
        targetMarketplace: "marketplace",
        supplierSource: "snapshot",
        businessGoal: "discover_new_products",
        region: "United States",
        currency: "USD",
        useInventoryContext: false
      },
      product: "Web Scraper API",
      collectedAt: new Date().toISOString(),
      maxResults: config.maxResults
    }).products.length) {
      return payload;
    }

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500 * (attempt + 1)));
  }

  return null;
}

async function attemptStructuredScraper(
  context: MarketContextPayload,
  config: BrightDataConfig,
  collectedAt: string
): Promise<BrightDataAttemptResult> {
  const operation = resolveBrightDataOperation(context, config);

  if (!config.webScraperEndpoint || !operation) {
    return {
      attempt: {
        product: "Web Scraper API",
        status: "skipped",
        message: "Structured Bright Data dataset was not configured for this marketplace."
      } satisfies BrightDataAttempt
    };
  }

  try {
    const requestBody = {
      input: [operation.input],
      limit: config.maxResults
    };
    const payload = await requestJson(
      scraperRequestEndpoint(config.webScraperEndpoint, operation),
      config.apiKey ?? "",
      requestBody,
      config.timeoutMs
    );
    const snapshotId = findSnapshotId(payload);
    let normalized = normalizeBrightDataPayload(payload, {
      context,
      product: "Web Scraper API",
      collectedAt,
      maxResults: config.maxResults
    });

    if (!normalized.products.length) {
      const snapshotPayload = snapshotId ? await pollSnapshotPayload(snapshotId, config) : null;

      if (snapshotPayload) {
        normalized = normalizeBrightDataPayload(snapshotPayload, {
          context,
          product: "Web Scraper API",
          collectedAt,
          maxResults: config.maxResults
        });
      }
    }

    if (!normalized.products.length) {
      return {
        attempt: {
          product: "Web Scraper API",
          status: "empty",
          message: snapshotId
            ? "Structured Bright Data scraper returned a snapshot id but no usable product records."
            : "Structured Bright Data scraper returned zero usable product records.",
          sourceProduct: operation.sourceProduct,
          sourceName: operation.sourceName,
          marketplace: operation.marketplace,
          inputType: operation.inputType,
          operation: operation.operation,
          datasetId: operation.datasetId,
          scraperName: operation.scraperName,
          snapshotId,
          recordCount: 0
        } satisfies BrightDataAttempt
      };
    }

    const status = normalizedStatus(normalized.products);

    return {
      attempt: {
        product: "Web Scraper API",
        status,
        message:
          status === "partial"
            ? "Structured Bright Data scraper returned product records with missing critical fields."
            : "Structured Bright Data scraper returned normalized product records.",
        sourceProduct: operation.sourceProduct,
        sourceName: operation.sourceName,
        marketplace: operation.marketplace,
        inputType: operation.inputType,
        operation: operation.operation,
        datasetId: operation.datasetId,
        scraperName: operation.scraperName,
        snapshotId,
        recordCount: normalized.products.length
      } satisfies BrightDataAttempt,
      ...normalized
    };
  } catch (error) {
    return {
      attempt: {
        product: "Web Scraper API",
        status: "failed",
        message: "Structured Bright Data scraper request failed safely.",
        safeError: safeError(error),
        sourceProduct: operation.sourceProduct,
        sourceName: operation.sourceName,
        marketplace: operation.marketplace,
        inputType: operation.inputType,
        operation: operation.operation,
        datasetId: operation.datasetId,
        scraperName: operation.scraperName,
        recordCount: 0
      } satisfies BrightDataAttempt
    };
  }
}

async function attemptWebUnlocker(
  context: MarketContextPayload,
  config: BrightDataConfig,
  collectedAt: string
): Promise<BrightDataAttemptResult> {
  if (!config.webUnlockerEndpoint || !config.webUnlockerZone) {
    return {
      attempt: {
        product: "Web Unlocker",
        status: "skipped",
        message: "Bright Data Web Unlocker endpoint or zone was not configured."
      } satisfies BrightDataAttempt
    };
  }

  const url = buildMarketplaceSearchUrl(context);
  const payload = await requestJson(
    config.webUnlockerEndpoint,
    config.apiKey ?? "",
    {
      zone: config.webUnlockerZone,
      url,
      format: config.defaultFormat,
      country: config.defaultCountry
    },
    config.timeoutMs
  );
  const htmlSummary =
    typeof payload === "string"
      ? {
          results: [
            {
              title: context.productName,
              url,
              snippet: sanitizeEvidenceSnippet(payload) ?? `${context.productName} observed through Web Unlocker.`,
              sourceMarketplace: context.targetMarketplace
            }
          ]
        }
      : payload;
  const normalized = normalizeBrightDataPayload(htmlSummary, {
    context,
    product: "Web Unlocker",
    collectedAt,
    maxResults: config.maxResults
  });

  if (!normalized.products.length) {
    throw new Error("Web Unlocker returned no product-like records.");
  }

    const status = normalizedStatus(normalized.products);

    return {
      attempt: {
        product: "Web Unlocker",
        status,
        message:
          status === "partial"
            ? "Bright Data Web Unlocker returned product-like records with partial fields."
            : "Bright Data Web Unlocker returned safe summarized evidence.",
      sourceProduct: "web_unlocker",
      sourceName: "Marketplace Search via Web Unlocker",
      marketplace: marketplaceKeyForContext(context),
      inputType: classifyBrightDataInput(context).inputType,
      operation: "web_unlocker_marketplace_search",
      scraperName: "Bright Data Web Unlocker",
      recordCount: normalized.products.length
    } satisfies BrightDataAttempt,
    ...normalized
  };
}

function fallbackResult(
  context: MarketContextPayload,
  config: BrightDataConfig,
  collectedAt: string,
  attempts: BrightDataAttempt[],
  fallbackReason: string,
  options: { preferSnapshot?: boolean } = {}
): BrightDataCollectionResult {
  const liveAttempted = hasLiveAttempt(attempts);
  const snapshot = options.preferSnapshot ? loadFallbackSnapshot(context, collectedAt, config.maxResults) : null;

  if (snapshot) {
    return {
      status: "fallback",
      brightDataProduct: snapshot.product,
      label: "Bright Data live attempt failed; preserved raw snapshot is being used.",
      collectedAt,
      usedFallback: true,
      fallbackReason,
      fallbackKind: "snapshot",
      sourceProvider: "brightdata",
      sourceProduct: "web_scraper_api",
      sourceProducts: [snapshot.sourceName],
      targetMarketplace: marketplaceKeyForContext(context),
      inputType: classifyBrightDataInput(context).inputType,
      operation: snapshot.sourceType,
      scraperName: snapshot.sourceName,
      liveAttempted,
      liveSucceeded: false,
      rawSnapshotsSaved: 0,
      rawSnapshotsLoaded: 1,
      rawSnapshotRefs: [snapshot.ref],
      attempts,
      products: snapshot.products.slice(0, config.maxResults),
      evidenceRefs: snapshot.evidenceRefs.slice(0, config.maxResults * 3),
      warnings: [fallbackReason],
      maxResults: config.maxResults
    };
  }

  const fallback = createFallbackProducts(context, collectedAt, config.maxResults, fallbackReason);

  return {
    status: "fallback",
    brightDataProduct: "Web Unlocker",
    label: liveAttempted
      ? "Bright Data live attempt failed; deterministic demo seed is being used."
      : "Bright Data live collection was not attempted; deterministic demo seed is being used.",
    collectedAt,
    usedFallback: true,
    fallbackReason,
    fallbackKind: "demo_seed",
    sourceProvider: "demo",
    sourceProduct: "demo_seed",
    sourceProducts: ["Demo seed"],
    targetMarketplace: marketplaceKeyForContext(context),
    inputType: classifyBrightDataInput(context).inputType,
    liveAttempted,
    liveSucceeded: false,
    rawSnapshotsSaved: 0,
    rawSnapshotsLoaded: 0,
    rawSnapshotRefs: [],
    attempts,
    products: fallback.products,
    evidenceRefs: fallback.evidenceRefs,
    warnings: [fallbackReason],
    maxResults: config.maxResults
  };
}

export async function collectBrightDataEvidence(
  context: MarketContextPayload,
  overrideConfig?: Partial<BrightDataConfig>
): Promise<BrightDataCollectionResult> {
  const config = { ...getBrightDataConfig(), ...overrideConfig };
  const collectedAt = new Date().toISOString();
  const attempts: BrightDataAttempt[] = [];
  const env = validateBrightDataEnv(config);

  if (!config.useLiveWeb) {
    return fallbackResult(context, config, collectedAt, attempts, "AMI_USE_LIVE_WEB is disabled.");
  }

  if (!env.configured) {
    const reason = `Bright Data is not fully configured: ${env.missing.join(", ")}.`;

    if (config.allowFallback) {
      return fallbackResult(context, config, collectedAt, attempts, reason);
    }

    return {
      status: "not_configured",
      brightDataProduct: "Web Unlocker",
      label: "Bright Data is not configured and fallback is disabled.",
      collectedAt,
      usedFallback: false,
      fallbackReason: reason,
      fallbackKind: "none",
      sourceProvider: "unknown",
      sourceProduct: "unknown",
      sourceProducts: [],
      targetMarketplace: marketplaceKeyForContext(context),
      inputType: classifyBrightDataInput(context).inputType,
      liveAttempted: false,
      liveSucceeded: false,
      rawSnapshotsSaved: 0,
      rawSnapshotsLoaded: 0,
      rawSnapshotRefs: [],
      attempts,
      products: [],
      evidenceRefs: [],
      warnings: [reason],
      maxResults: config.maxResults
    };
  }

  const runners: Array<{ product: BrightDataProduct; run: () => Promise<BrightDataAttemptResult> }> = [
    { product: "Web Scraper API", run: () => attemptStructuredScraper(context, config, collectedAt) },
    { product: "Web Unlocker", run: () => attemptWebUnlocker(context, config, collectedAt) }
  ];

  for (const runner of runners) {
    try {
      const result = await runner.run();
      const attempt = {
        ...result.attempt,
        sourceName: result.attempt.sourceName ?? sourceNameForProduct(result.attempt.product as BrightDataProduct, context),
        sourceProduct:
          result.attempt.sourceProduct ??
          (result.attempt.product === "Web Unlocker"
            ? "web_unlocker"
            : result.attempt.product === "Web Scraper API"
              ? "web_scraper_api"
              : "serp_api"),
        marketplace: result.attempt.marketplace ?? marketplaceKeyForContext(context),
        inputType: result.attempt.inputType ?? classifyBrightDataInput(context).inputType,
        recordCount: result.products?.length ?? result.attempt.recordCount
      };
      attempts.push(attempt);

      if (result.products?.length && result.evidenceRefs?.length) {
        const products = result.products.slice(0, config.maxResults);
        const evidenceRefs = result.evidenceRefs.slice(0, config.maxResults * 3);

        return {
          status: "live",
          brightDataProduct: attempt.product as BrightDataProduct,
          label: `${attempt.product} live collection completed.`,
          collectedAt,
          usedFallback: false,
          fallbackKind: "none",
          sourceProvider: "brightdata",
          sourceProduct: attempt.sourceProduct,
          sourceProducts: [attempt.sourceName],
          targetMarketplace: attempt.marketplace,
          inputType: attempt.inputType,
          operation: attempt.operation,
          datasetId: attempt.datasetId,
          scraperName: attempt.scraperName,
          snapshotId: attempt.snapshotId,
          liveAttempted: true,
          liveSucceeded: true,
          rawSnapshotsSaved: 1,
          rawSnapshotsLoaded: 0,
          rawSnapshotRefs: ["mongo:rawSourceSnapshots"],
          attempts,
          products,
          evidenceRefs,
          warnings: [],
          maxResults: config.maxResults
        };
      }
    } catch (error) {
      attempts.push({
        product: runner.product,
        status: "failed",
        message: "Bright Data attempt failed safely.",
        safeError: safeError(error),
        sourceName: sourceNameForProduct(runner.product, context),
        sourceProduct: runner.product === "Web Unlocker" ? "web_unlocker" : "web_scraper_api",
        marketplace: marketplaceKeyForContext(context),
        inputType: classifyBrightDataInput(context).inputType,
        operation: runner.product === "Web Unlocker" ? "web_unlocker_marketplace_search" : undefined,
        scraperName: runner.product === "Web Unlocker" ? "Bright Data Web Unlocker" : undefined
      });
    }
  }

  const reason = attempts.find((attempt) => attempt.safeError)?.safeError ?? "Bright Data returned no usable normalized product data.";

  if (config.allowFallback) {
    return fallbackResult(context, config, collectedAt, attempts, reason, { preferSnapshot: hasLiveAttempt(attempts) });
  }

  return {
    status: "error",
    brightDataProduct: "Web Unlocker",
    label: "Bright Data collection failed and fallback is disabled.",
    collectedAt,
    usedFallback: false,
    fallbackReason: reason,
    fallbackKind: "none",
    sourceProvider: "unknown",
    sourceProduct: "unknown",
    sourceProducts: [],
    targetMarketplace: marketplaceKeyForContext(context),
    inputType: classifyBrightDataInput(context).inputType,
    liveAttempted: hasLiveAttempt(attempts),
    liveSucceeded: false,
    rawSnapshotsSaved: 0,
    rawSnapshotsLoaded: 0,
    rawSnapshotRefs: [],
    attempts,
    products: [],
    evidenceRefs: [],
    warnings: [reason],
    maxResults: config.maxResults
  };
}
