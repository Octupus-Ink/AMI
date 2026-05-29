import type { MarketContextPayload, NormalizedProduct } from "@/lib/schemas/ami";
import type { EvidenceRef } from "@/lib/schemas/agents";

export type BrightDataProduct = "Web Scraper API" | "Web Unlocker" | "SERP API";

export type BrightDataProviderStatus = "live" | "fallback" | "not_configured" | "disabled" | "error";
export type BrightDataFallbackKind = "none" | "snapshot" | "demo_seed";
export type BrightDataSourceProvider = "brightdata" | "demo" | "unknown";
export type BrightDataSourceProduct = "web_scraper_api" | "web_unlocker" | "serp_api" | "demo_seed" | "unknown";
export type BrightDataMarketplace = "amazon" | "ebay" | "alibaba" | "aliexpress" | "tiktok" | "marketplace";
export type BrightDataInputType = "keyword" | "category_url" | "product_url" | "shop_url";

export type BrightDataConfig = {
  apiKey?: string;
  useLiveWeb: boolean;
  allowFallback: boolean;
  webUnlockerEndpoint?: string;
  webScraperEndpoint?: string;
  webScraperTriggerEndpoint?: string;
  webScraperProgressEndpoint?: string;
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
  amazonProductsDiscoverType?: string;
  amazonProductsDiscoverBy?: string;
  amazonProductsInputKey?: string;
  ebayDatasetId?: string;
  ebayKeywordDiscoverType?: string;
  ebayKeywordDiscoverBy?: string;
  ebayKeywordInputKey?: string;
  ebayCategoryInputKey?: string;
  ebayProductUrlInputKey?: string;
  ebayShopUrlInputKey?: string;
  alibabaProductsDatasetId?: string;
  aliexpressProductsDatasetId?: string;
  tiktokShopProductsDatasetId?: string;
};

export type BrightDataOperation = {
  marketplace: BrightDataMarketplace;
  inputType: BrightDataInputType;
  product: Extract<BrightDataProduct, "Web Scraper API">;
  sourceProduct: Extract<BrightDataSourceProduct, "web_scraper_api">;
  sourceName: string;
  sourceType: string;
  scraperName: string;
  operation: string;
  datasetId: string;
  discoverType?: string;
  discoverBy?: string;
  inputKey: string;
  input: Record<string, string>;
};

export type BrightDataAttempt = {
  product: BrightDataProduct;
  status: "success" | "skipped" | "failed" | "empty";
  message: string;
  safeError?: string;
  sourceName?: string;
  sourceProduct?: BrightDataSourceProduct;
  marketplace?: BrightDataMarketplace;
  inputType?: BrightDataInputType;
  operation?: string;
  datasetId?: string;
  scraperName?: string;
  snapshotId?: string;
  recordCount?: number;
};

export type BrightDataCollectionResult = {
  status: BrightDataProviderStatus;
  brightDataProduct: BrightDataProduct;
  label: string;
  collectedAt: string;
  usedFallback: boolean;
  fallbackReason?: string;
  fallbackKind: BrightDataFallbackKind;
  sourceProvider: BrightDataSourceProvider;
  sourceProduct: BrightDataSourceProduct;
  sourceProducts: string[];
  targetMarketplace?: BrightDataMarketplace;
  inputType?: BrightDataInputType;
  operation?: string;
  datasetId?: string;
  scraperName?: string;
  snapshotId?: string;
  liveAttempted: boolean;
  liveSucceeded: boolean;
  rawSnapshotsSaved: number;
  rawSnapshotsLoaded: number;
  rawSnapshotRefs: string[];
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
