import type { MarketContextPayload, NormalizedProduct } from "@/lib/schemas/ami";
import type { EvidenceRef } from "@/lib/schemas/agents";

export type BrightDataProduct = "Web Scraper API" | "Web Unlocker" | "SERP API";

export type BrightDataProviderStatus = "live" | "fallback" | "not_configured" | "disabled" | "error";

export type BrightDataConfig = {
  apiKey?: string;
  useLiveWeb: boolean;
  allowFallback: boolean;
  webUnlockerEndpoint?: string;
  webScraperEndpoint?: string;
  serpEndpoint?: string;
  discoverEndpoint?: string;
  webUnlockerZone?: string;
  serpZone?: string;
  defaultZone?: string;
  defaultCountry: string;
  defaultFormat: string;
  timeoutMs: number;
  maxResults: number;
  amazonProductsDatasetId?: string;
  amazonSearchDatasetId?: string;
  alibabaProductsDatasetId?: string;
  aliexpressProductsDatasetId?: string;
  tiktokShopProductsDatasetId?: string;
};

export type BrightDataAttempt = {
  product: BrightDataProduct;
  status: "success" | "skipped" | "failed";
  message: string;
  safeError?: string;
};

export type BrightDataCollectionResult = {
  status: BrightDataProviderStatus;
  brightDataProduct: BrightDataProduct;
  label: string;
  collectedAt: string;
  usedFallback: boolean;
  fallbackReason?: string;
  attempts: BrightDataAttempt[];
  products: NormalizedProduct[];
  evidenceRefs: EvidenceRef[];
  warnings: string[];
  maxResults: number;
};

export type BrightDataPayloadContext = {
  context: MarketContextPayload;
  product: BrightDataProduct;
  collectedAt: string;
  maxResults: number;
};
