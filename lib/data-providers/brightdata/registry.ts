import type { MarketContextPayload } from "@/lib/schemas/ami";
import type {
  BrightDataConfig,
  BrightDataInputType,
  BrightDataMarketplace,
  BrightDataOperation
} from "@/lib/data-providers/brightdata/types";

function readText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readUrl(value: unknown) {
  const raw = readText(value);

  if (!raw || !/^https?:\/\//i.test(raw)) {
    return null;
  }

  try {
    const parsed = new URL(raw);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed : null;
  } catch {
    return null;
  }
}

export function marketplaceKeyForContext(context: MarketContextPayload): BrightDataMarketplace {
  const text = `${context.targetMarketplace} ${context.supplierSource} ${context.productName}`.toLowerCase();

  if (text.includes("amazon")) {
    return "amazon";
  }

  if (text.includes("ebay")) {
    return "ebay";
  }

  if (text.includes("aliexpress")) {
    return "aliexpress";
  }

  if (text.includes("alibaba")) {
    return "alibaba";
  }

  if (text.includes("tiktok")) {
    return "tiktok";
  }

  return "marketplace";
}

export function classifyBrightDataInput(context: MarketContextPayload): {
  inputType: BrightDataInputType;
  inputValue: string;
  url?: string;
} {
  const url = [context.productName, context.category, context.targetMarketplace, context.supplierSource]
    .map((value) => readUrl(value))
    .find((candidate): candidate is URL => Boolean(candidate));
  const marketplace = marketplaceKeyForContext(context);

  if (url && marketplace === "ebay") {
    const path = url.pathname.toLowerCase();

    if (path.includes("/itm/")) {
      return { inputType: "product_url", inputValue: url.toString(), url: url.toString() };
    }

    if (path.includes("/b/")) {
      return { inputType: "category_url", inputValue: url.toString(), url: url.toString() };
    }

    if (path.includes("/str/") || path.includes("/usr/") || path.includes("/store/") || path.includes("/shop/")) {
      return { inputType: "shop_url", inputValue: url.toString(), url: url.toString() };
    }
  }

  return {
    inputType: "keyword",
    inputValue: `${context.productName} ${context.category}`.replace(/\s+/g, " ").trim()
  };
}

export function buildMarketplaceSearchUrl(context: MarketContextPayload) {
  const query = encodeURIComponent(`${context.productName} ${context.category}`.trim());
  const marketplace = marketplaceKeyForContext(context);

  if (marketplace === "amazon") {
    return `https://www.amazon.com/s?k=${query}`;
  }

  if (marketplace === "ebay") {
    return `https://www.ebay.com/sch/i.html?_nkw=${query}`;
  }

  if (marketplace === "aliexpress") {
    return `https://www.aliexpress.com/wholesale?SearchText=${query}`;
  }

  if (marketplace === "alibaba") {
    return `https://www.alibaba.com/trade/search?SearchText=${query}`;
  }

  return `https://www.google.com/search?q=${query}`;
}

function withZipcode(input: Record<string, string>) {
  return { ...input, zipcode: "" };
}

export function resolveBrightDataOperation(
  context: MarketContextPayload,
  config: BrightDataConfig
): BrightDataOperation | null {
  const marketplace = marketplaceKeyForContext(context);
  const detected = classifyBrightDataInput(context);

  if (marketplace === "amazon" && config.amazonProductsDatasetId) {
    const inputKey = config.amazonProductsInputKey || "keyword";

    return {
      marketplace,
      inputType: "keyword",
      product: "Web Scraper API",
      sourceProduct: "web_scraper_api",
      sourceName: "Amazon Products Search",
      sourceType: "amazon_products_search",
      scraperName: "Amazon Products",
      operation: "amazon_products_keyword",
      datasetId: config.amazonProductsDatasetId,
      discoverType: config.amazonProductsDiscoverType || "discover_new",
      discoverBy: config.amazonProductsDiscoverBy || "keyword",
      inputKey,
      input: withZipcode({ [inputKey]: detected.inputValue })
    };
  }

  if (marketplace === "ebay" && config.ebayDatasetId) {
    const inputKeyByType: Record<BrightDataInputType, string> = {
      keyword: config.ebayKeywordInputKey || "keywords",
      category_url: config.ebayCategoryInputKey || "url",
      product_url: config.ebayProductUrlInputKey || "url",
      shop_url: config.ebayShopUrlInputKey || "url"
    };
    const sourceNameByType: Record<BrightDataInputType, string> = {
      keyword: "eBay Keyword Search",
      category_url: "eBay Category URL",
      product_url: "eBay Product URL",
      shop_url: "eBay Shop URL"
    };
    const inputKey = inputKeyByType[detected.inputType];

    return {
      marketplace,
      inputType: detected.inputType,
      product: "Web Scraper API",
      sourceProduct: "web_scraper_api",
      sourceName: sourceNameByType[detected.inputType],
      sourceType: `ebay_${detected.inputType}`,
      scraperName: "eBay Products",
      operation: `ebay_${detected.inputType}`,
      datasetId: config.ebayDatasetId,
      discoverType: detected.inputType === "keyword" ? config.ebayKeywordDiscoverType || "discover_new" : undefined,
      discoverBy: detected.inputType === "keyword" ? config.ebayKeywordDiscoverBy || "keywords" : undefined,
      inputKey,
      input: { [inputKey]: detected.inputValue }
    };
  }

  return null;
}

export function scraperRequestEndpoint(endpoint: string, operation: BrightDataOperation) {
  const url = new URL(endpoint);
  url.searchParams.set("dataset_id", operation.datasetId);
  url.searchParams.set("include_errors", "true");

  if (operation.discoverType) {
    url.searchParams.set("type", operation.discoverType);
  }

  if (operation.discoverBy) {
    url.searchParams.set("discover_by", operation.discoverBy);
  }

  return url.toString();
}
