import type { AssistantUsage, MarketContextPayload, Recommendation } from "@/lib/schemas/ami";

export const demoUser = {
  id: "demo-user",
  name: "AMI Demo Operator",
  email: "demo@ami.local"
};

export const demoWorkspace = {
  id: "demo-workspace",
  workspaceName: "AMI Demo Workspace",
  workspaceType: "Marketplace operator",
  defaultRegion: "United States",
  defaultCurrency: "USD",
  createdByUserId: demoUser.id
};

export const demoMarketplaceProfile = {
  workspaceId: demoWorkspace.id,
  businessName: "Northstar Marketplace",
  businessType: "Marketplace operator",
  primaryMarketplace: "Amazon",
  mainProductCategory: "Home and kitchen",
  targetRegion: "United States",
  defaultCurrency: "USD"
};

export const demoMarketContext: MarketContextPayload = {
  productName: "Insulated stainless steel tumbler",
  category: "Drinkware",
  targetMarketplace: "Amazon",
  supplierSource: "Verified supplier catalog",
  businessGoal: "discover_new_products",
  region: "United States",
  currency: "USD",
  useInventoryContext: true
};

export const demoAssistantUsage: AssistantUsage[] = [
  {
    assistantId: "trend",
    usageCount: 10,
    creditLimit: 130,
    creditsUsed: 47,
    estimatedUsageCost: 4.7,
    lastRun: "2026-05-26T18:10:00.000Z",
    latestContribution: "Validated demand momentum, seasonality, and social signal direction.",
    dataSourcesUsed: ["Bright Data SERP API demo fallback", "Social momentum snapshot"],
    alertState: "normal"
  },
  {
    assistantId: "competitor",
    usageCount: 12,
    creditLimit: 120,
    creditsUsed: 82,
    estimatedUsageCost: 8.2,
    lastRun: "2026-05-26T18:10:00.000Z",
    latestContribution: "Compared competitor pricing, promotion pressure, and availability.",
    dataSourcesUsed: ["Bright Data SERP API demo fallback", "Marketplace product snapshot"],
    alertState: "normal"
  },
  {
    assistantId: "supplier",
    usageCount: 8,
    creditLimit: 100,
    creditsUsed: 63,
    estimatedUsageCost: 6.3,
    lastRun: "2026-05-26T18:10:00.000Z",
    latestContribution: "Found viable supplier options with estimated unit cost and delivery windows.",
    dataSourcesUsed: ["Supplier catalog demo snapshot", "Bright Data marketplace source footprint"],
    alertState: "normal"
  },
  {
    assistantId: "inventory",
    usageCount: 9,
    creditLimit: 100,
    creditsUsed: 91,
    estimatedUsageCost: 9.1,
    lastRun: "2026-05-26T18:10:00.000Z",
    latestContribution: "Reviewed stock posture, margin context, and sourcing risk.",
    dataSourcesUsed: ["Workspace inventory context", "Supplier margin snapshot"],
    alertState: "near_limit"
  }
];

export const demoCredits = {
  workspaceId: demoWorkspace.id,
  balance: 250,
  initialDemoCredits: 250,
  lastLedgerEvent: "Initial demo grant"
};

export const demoInventoryStatus = {
  workspaceId: demoWorkspace.id,
  connected: true,
  marketplaceName: "Amazon",
  marketplaceUrl: "",
  connectionType: "demo_snapshot",
  credentialType: "demo_snapshot",
  latestConnectionLabel: "Amazon - demo_snapshot",
  lastSyncAt: "2026-05-26T20:45:44.000Z",
  lastAnalysisAt: "2026-05-26T20:45:44.000Z",
  status: "demo_snapshot"
};

export const demoSavedReports = [
  {
    id: "saved-report-demo",
    title: "Drinkware opportunity review",
    createdAt: "2026-05-26T20:55:00.000Z",
    status: "saved"
  }
];

export const demoApprovedRecommendations: Recommendation[] = [];

export const demoSerpResults = [
  {
    title: "Amazon insulated tumbler marketplace listing",
    url: "https://www.amazon.com/s?k=insulated+tumbler",
    sourceMarketplace: "Amazon",
    priceSignal: 29.99,
    freshness: "Demo snapshot seeded for Bright Data-shaped SERP output"
  },
  {
    title: "Shopping trend results for insulated tumbler",
    url: "https://www.google.com/search?q=insulated+tumbler+trend",
    sourceMarketplace: "Google Search",
    priceSignal: 31.5,
    freshness: "Demo snapshot seeded for Bright Data-shaped SERP output"
  }
];

export const demoCompetitorSnapshot = {
  sourceMarketplace: "Amazon",
  sourceUrl: "https://www.amazon.com/s?k=insulated+tumbler",
  productIdentity: "Insulated stainless steel tumbler, 40 oz",
  currentPrice: 29.99,
  competitorPriceMedian: 34.5,
  promotionPressure: "moderate",
  availability: "in_stock",
  scrapedAt: "2026-05-26T20:50:00.000Z"
};
