import { demoCompetitorSnapshot, demoSerpResults } from "@/lib/demo/data";

type BrightDataResponse<T> = {
  source: "bright-data" | "demo-fallback";
  data: T;
  message?: string;
};

function hasBrightDataCredentials() {
  return Boolean(process.env.BRIGHT_DATA_API_KEY?.trim());
}

async function brightDataFetch<T>(endpoint: string, body: Record<string, unknown>): Promise<BrightDataResponse<T>> {
  const apiKey = process.env.BRIGHT_DATA_API_KEY;

  if (!apiKey || !endpoint) {
    return {
      source: "demo-fallback",
      data: {} as T,
      message: "Bright Data credentials or endpoint are missing"
    };
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Bright Data request failed with ${response.status}`);
  }

  return {
    source: "bright-data",
    data: (await response.json()) as T
  };
}

export async function searchSERP(query: string): Promise<BrightDataResponse<typeof demoSerpResults>> {
  if (!hasBrightDataCredentials() || !process.env.BRIGHT_DATA_SERP_ENDPOINT) {
    return {
      source: "demo-fallback",
      data: demoSerpResults,
      message: "Using demo SERP results because Bright Data SERP credentials are not configured"
    };
  }

  return brightDataFetch<typeof demoSerpResults>(process.env.BRIGHT_DATA_SERP_ENDPOINT, {
    query,
    parse: true
  });
}

export async function scrapeProductPage(url: string): Promise<BrightDataResponse<typeof demoCompetitorSnapshot>> {
  if (!hasBrightDataCredentials()) {
    return {
      source: "demo-fallback",
      data: demoCompetitorSnapshot,
      message: "Using demo product scrape results because Bright Data credentials are not configured"
    };
  }

  const endpoint = process.env.BRIGHT_DATA_WEB_SCRAPER_ENDPOINT || process.env.BRIGHT_DATA_SERP_ENDPOINT;

  if (!endpoint) {
    return {
      source: "demo-fallback",
      data: demoCompetitorSnapshot,
      message: "Using demo product scrape results because the scraper endpoint is not configured"
    };
  }

  return brightDataFetch<typeof demoCompetitorSnapshot>(endpoint, {
    url,
    parse: true
  });
}

export async function unlockUrl(url: string): Promise<BrightDataResponse<{ url: string; html?: string }>> {
  if (!hasBrightDataCredentials() || !process.env.BRIGHT_DATA_WEB_UNLOCKER_ENDPOINT) {
    return {
      source: "demo-fallback",
      data: { url },
      message: "Using demo unlock result because Bright Data Web Unlocker is not configured"
    };
  }

  return brightDataFetch<{ url: string; html?: string }>(process.env.BRIGHT_DATA_WEB_UNLOCKER_ENDPOINT, {
    url
  });
}
