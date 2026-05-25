import type { MarketplaceProject, RecentRun } from "@/lib/schemas/api";

const now = new Date().toISOString();

type DemoTrendSignal = {
  productName: string;
  trendScore: number;
  marketStatus: "declining" | "stable" | "growing" | "viral";
  seasonality: "low" | "medium" | "high";
  demandSignal: "weak" | "moderate" | "strong";
  searchVolumeChange: number;
};

export const demoUser = {
  email: "demo@marketplace.ai",
  name: "Demo Operator",
  role: "founder",
  createdAt: now
};

export const demoProject: MarketplaceProject = {
  id: "demo-project-1",
  userId: "demo-user-1",
  name: "Northstar Outdoor Gear",
  category: "Outdoor and travel accessories",
  targetMarket: "United States",
  trackedCompetitors: ["TrailPeak", "PackForge", "CampNest"],
  products: [
    {
      id: "prod-1",
      name: "TrailLite Daypack 24L",
      sku: "TL-DAY-24",
      price: 79,
      cost: 38,
      currentStock: 420,
      targetStock: 250,
      monthlySales: 92
    },
    {
      id: "prod-2",
      name: "HydroSteel Bottle 32oz",
      sku: "HS-BOT-32",
      price: 34,
      cost: 16,
      currentStock: 58,
      targetStock: 180,
      monthlySales: 210
    },
    {
      id: "prod-3",
      name: "SummitDry Packing Cubes",
      sku: "SD-CUBE-4",
      price: 42,
      cost: 18,
      currentStock: 310,
      targetStock: 190,
      monthlySales: 44
    }
  ],
  createdAt: now,
  updatedAt: now
};

export const demoCompetitorSnapshot = [
  {
    competitorName: "TrailPeak",
    productName: "TrailLite Daypack 24L",
    price: 69,
    stockStatus: "in_stock" as const,
    listPrice: 89,
    deliveryEstimate: "2-4 days"
  },
  {
    competitorName: "PackForge",
    productName: "HydroSteel Bottle 32oz",
    price: 37,
    stockStatus: "out_of_stock" as const,
    listPrice: 37,
    deliveryEstimate: "Unavailable"
  },
  {
    competitorName: "CampNest",
    productName: "SummitDry Packing Cubes",
    price: 36,
    stockStatus: "low_stock" as const,
    listPrice: 44,
    deliveryEstimate: "5-7 days"
  }
];

export const demoTrendSignals: DemoTrendSignal[] = [
  {
    productName: "TrailLite Daypack 24L",
    trendScore: 41,
    marketStatus: "declining" as const,
    seasonality: "medium" as const,
    demandSignal: "weak" as const,
    searchVolumeChange: -14
  },
  {
    productName: "HydroSteel Bottle 32oz",
    trendScore: 86,
    marketStatus: "growing" as const,
    seasonality: "high" as const,
    demandSignal: "strong" as const,
    searchVolumeChange: 31
  },
  {
    productName: "SummitDry Packing Cubes",
    trendScore: 52,
    marketStatus: "stable" as const,
    seasonality: "low" as const,
    demandSignal: "moderate" as const,
    searchVolumeChange: 3
  }
];

export const demoSerpResults = [
  {
    title: "Best travel gear deals this week",
    url: "https://example.com/demo/travel-gear",
    snippet: "Daypacks show softening demand while insulated bottles continue trending up.",
    source: "demo-fallback"
  },
  {
    title: "Outdoor accessories marketplace snapshot",
    url: "https://example.com/demo/marketplace-snapshot",
    snippet: "Several competitors are discounting packing organizers and entry-level daypacks.",
    source: "demo-fallback"
  }
];

export const demoRecentRuns: RecentRun[] = [
  {
    id: "demo-historical-1",
    status: "completed",
    startedAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    completedAt: new Date(Date.now() - 1000 * 60 * 60 * 6 + 1000 * 14).toISOString(),
    finalScore: 73,
    summary: "Demo historical run: healthy demand with two inventory risks."
  }
];
