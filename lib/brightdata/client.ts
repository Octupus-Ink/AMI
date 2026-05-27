import { demoCompetitorSnapshot, demoSerpResults } from "@/lib/demo/data";

export type BrightDataMode = "live" | "demo_fallback";

export type BrightDataResponse<T> = {
  mode: BrightDataMode;
  product: "SERP API" | "Web Scraper API" | "Web Unlocker";
  data: T;
  message: string;
};

function hasBrightDataCredentials() {
  return Boolean(process.env.BRIGHT_DATA_API_KEY?.trim());
}

async function brightDataFetch<T>(
  endpoint: string,
  product: BrightDataResponse<T>["product"],
  body: Record<string, unknown>
): Promise<BrightDataResponse<T>> {
  const apiKey = process.env.BRIGHT_DATA_API_KEY;

  if (!apiKey || !endpoint) {
    throw new Error("Bright Data endpoint or API key is missing");
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
    throw new Error(`Bright Data ${product} request failed with status ${response.status}`);
  }

  return {
    mode: "live",
    product,
    data: (await response.json()) as T,
    message: `Live Bright Data ${product} response`
  };
}

export async function searchSERP(query: string): Promise<BrightDataResponse<typeof demoSerpResults>> {
  if (!hasBrightDataCredentials() || !process.env.BRIGHT_DATA_SERP_ENDPOINT) {
    return {
      mode: "demo_fallback",
      product: "SERP API",
      data: demoSerpResults,
      message: "Bright Data SERP API is represented with a seeded demo fallback because live credentials are not configured."
    };
  }

  return brightDataFetch<typeof demoSerpResults>(process.env.BRIGHT_DATA_SERP_ENDPOINT, "SERP API", {
    query,
    parse: true
  });
}

export async function scrapeProductPage(url: string): Promise<BrightDataResponse<typeof demoCompetitorSnapshot>> {
  if (!hasBrightDataCredentials() || !process.env.BRIGHT_DATA_WEB_SCRAPER_ENDPOINT) {
    return {
      mode: "demo_fallback",
      product: "Web Scraper API",
      data: demoCompetitorSnapshot,
      message: "Bright Data Web Scraper API is represented with a seeded demo fallback because live credentials are not configured."
    };
  }

  return brightDataFetch<typeof demoCompetitorSnapshot>(process.env.BRIGHT_DATA_WEB_SCRAPER_ENDPOINT, "Web Scraper API", {
    url,
    parse: true
  });
}

export async function unlockUrl(url: string): Promise<BrightDataResponse<{ url: string; html?: string }>> {
  if (!hasBrightDataCredentials() || !process.env.BRIGHT_DATA_WEB_UNLOCKER_ENDPOINT) {
    return {
      mode: "demo_fallback",
      product: "Web Unlocker",
      data: { url },
      message: "Bright Data Web Unlocker is represented with a demo fallback because live credentials are not configured."
    };
  }

  return brightDataFetch<{ url: string; html?: string }>(process.env.BRIGHT_DATA_WEB_UNLOCKER_ENDPOINT, "Web Unlocker", {
    url
  });
}
