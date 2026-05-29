import type { MarketContextPayload } from "@/lib/schemas/ami";
import type { EvidenceRef } from "@/lib/schemas/agents";
import type { NormalizedProduct } from "@/lib/schemas/ami";
import { sanitizeEvidenceSnippet } from "@/lib/analysis/source-state";
import { createFallbackProducts, normalizeBrightDataPayload } from "@/lib/data-providers/brightdata/normalize";
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
    amazonSearchDatasetId: process.env.BRIGHT_DATA_AMAZON_SEARCH_DATASET_ID?.trim(),
    alibabaProductsDatasetId: process.env.BRIGHT_DATA_ALIBABA_PRODUCTS_DATASET_ID?.trim(),
    aliexpressProductsDatasetId: process.env.BRIGHT_DATA_ALIEXPRESS_PRODUCTS_DATASET_ID?.trim(),
    tiktokShopProductsDatasetId: process.env.BRIGHT_DATA_TIKTOK_SHOP_PRODUCTS_DATASET_ID?.trim()
  };
}

export function validateBrightDataEnv(config = getBrightDataConfig()) {
  const missing: string[] = [];

  if (!config.apiKey) {
    missing.push("BRIGHT_DATA_API_KEY");
  }

  if (!config.webUnlockerEndpoint && !config.webScraperEndpoint && !config.serpEndpoint) {
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

function buildMarketplaceSearchUrl(context: MarketContextPayload) {
  const query = encodeURIComponent(`${context.productName} ${context.category}`.trim());
  const marketplace = context.targetMarketplace.toLowerCase();

  if (marketplace.includes("amazon")) {
    return `https://www.amazon.com/s?k=${query}`;
  }

  if (marketplace.includes("aliexpress")) {
    return `https://www.aliexpress.com/wholesale?SearchText=${query}`;
  }

  if (marketplace.includes("alibaba")) {
    return `https://www.alibaba.com/trade/search?SearchText=${query}`;
  }

  return `https://www.google.com/search?q=${query}`;
}

function datasetIdForContext(context: MarketContextPayload, config: BrightDataConfig) {
  const marketplace = `${context.targetMarketplace} ${context.supplierSource}`.toLowerCase();

  if (marketplace.includes("amazon")) {
    return config.amazonSearchDatasetId || config.amazonProductsDatasetId;
  }

  if (marketplace.includes("aliexpress")) {
    return config.aliexpressProductsDatasetId;
  }

  if (marketplace.includes("alibaba")) {
    return config.alibabaProductsDatasetId;
  }

  if (marketplace.includes("tiktok")) {
    return config.tiktokShopProductsDatasetId;
  }

  return undefined;
}

async function requestJson(endpoint: string, apiKey: string, body: Record<string, unknown>, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
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

async function attemptStructuredScraper(
  context: MarketContextPayload,
  config: BrightDataConfig,
  collectedAt: string
): Promise<BrightDataAttemptResult> {
  const datasetId = datasetIdForContext(context, config);

  if (!config.webScraperEndpoint || !datasetId) {
    return {
      attempt: {
        product: "Web Scraper API",
        status: "skipped",
        message: "Structured Bright Data dataset was not configured for this marketplace."
      } satisfies BrightDataAttempt
    };
  }

  const payload = await requestJson(
    config.webScraperEndpoint,
    config.apiKey ?? "",
    {
      dataset_id: datasetId,
      input: [{ url: buildMarketplaceSearchUrl(context), keyword: context.productName }],
      limit: config.maxResults
    },
    config.timeoutMs
  );
  const normalized = normalizeBrightDataPayload(payload, {
    context,
    product: "Web Scraper API",
    collectedAt,
    maxResults: config.maxResults
  });

  if (!normalized.products.length) {
    throw new Error("Structured scraper returned no product-like records.");
  }

  return {
    attempt: {
      product: "Web Scraper API",
      status: "success",
      message: "Structured Bright Data scraper returned normalized product records."
    } satisfies BrightDataAttempt,
    ...normalized
  };
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

  return {
    attempt: {
      product: "Web Unlocker",
      status: "success",
      message: "Bright Data Web Unlocker returned safe summarized evidence."
    } satisfies BrightDataAttempt,
    ...normalized
  };
}

async function attemptSerp(
  context: MarketContextPayload,
  config: BrightDataConfig,
  collectedAt: string
): Promise<BrightDataAttemptResult> {
  if (!config.serpEndpoint || !config.serpZone) {
    return {
      attempt: {
        product: "SERP API",
        status: "skipped",
        message: "Bright Data SERP endpoint or zone was not configured."
      } satisfies BrightDataAttempt
    };
  }

  const url = `https://www.google.com/search?q=${encodeURIComponent(`${context.productName} ${context.targetMarketplace}`)}`;
  const payload = await requestJson(
    config.serpEndpoint,
    config.apiKey ?? "",
    {
      zone: config.serpZone,
      url,
      format: "json",
      country: config.defaultCountry
    },
    config.timeoutMs
  );
  const normalized = normalizeBrightDataPayload(payload, {
    context,
    product: "SERP API",
    collectedAt,
    maxResults: config.maxResults
  });

  if (!normalized.products.length) {
    throw new Error("SERP returned no product-like records.");
  }

  return {
    attempt: {
      product: "SERP API",
      status: "success",
      message: "Bright Data SERP returned normalized result records."
    } satisfies BrightDataAttempt,
    ...normalized
  };
}

function fallbackResult(
  context: MarketContextPayload,
  config: BrightDataConfig,
  collectedAt: string,
  attempts: BrightDataAttempt[],
  fallbackReason: string
): BrightDataCollectionResult {
  const fallback = createFallbackProducts(context, collectedAt, config.maxResults, fallbackReason);

  return {
    status: "fallback",
    brightDataProduct: "Web Unlocker",
    label: "Bright Data attempted first; deterministic fallback data is being used.",
    collectedAt,
    usedFallback: true,
    fallbackReason,
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
      attempts,
      products: [],
      evidenceRefs: [],
      warnings: [reason],
      maxResults: config.maxResults
    };
  }

  const runners: Array<{ product: BrightDataProduct; run: () => Promise<BrightDataAttemptResult> }> = [
    { product: "Web Scraper API", run: () => attemptStructuredScraper(context, config, collectedAt) },
    { product: "Web Unlocker", run: () => attemptWebUnlocker(context, config, collectedAt) },
    { product: "SERP API", run: () => attemptSerp(context, config, collectedAt) }
  ];

  for (const runner of runners) {
    try {
      const result = await runner.run();
      attempts.push(result.attempt);

      if (result.products?.length && result.evidenceRefs?.length) {
        return {
          status: "live",
          brightDataProduct: result.attempt.product as BrightDataProduct,
          label: `${result.attempt.product} live collection completed.`,
          collectedAt,
          usedFallback: false,
          attempts,
          products: result.products.slice(0, config.maxResults),
          evidenceRefs: result.evidenceRefs.slice(0, config.maxResults * 3),
          warnings: [],
          maxResults: config.maxResults
        };
      }
    } catch (error) {
      attempts.push({
        product: runner.product,
        status: "failed",
        message: "Bright Data attempt failed safely.",
        safeError: safeError(error)
      });
    }
  }

  const reason = attempts.find((attempt) => attempt.safeError)?.safeError ?? "Bright Data returned no usable normalized product data.";

  if (config.allowFallback) {
    return fallbackResult(context, config, collectedAt, attempts, reason);
  }

  return {
    status: "error",
    brightDataProduct: "Web Unlocker",
    label: "Bright Data collection failed and fallback is disabled.",
    collectedAt,
    usedFallback: false,
    fallbackReason: reason,
    attempts,
    products: [],
    evidenceRefs: [],
    warnings: [reason],
    maxResults: config.maxResults
  };
}
