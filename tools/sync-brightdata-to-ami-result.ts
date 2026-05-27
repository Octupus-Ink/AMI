import mongoose from "mongoose";
import { loadEnvConfig } from "@next/env";
import {
  AnalysisRun,
  AssistantRun,
  AssistantUsageModel,
  EvidencePackageModel,
  Opportunity as AppOpportunity,
  RawSourceSnapshot,
  RecommendationModel,
  Workspace
} from "../models/ami";

loadEnvConfig(process.cwd());

type RawOpportunity = {
  _id: mongoose.Types.ObjectId;
  runId: mongoose.Types.ObjectId;
  source?: string;
  externalId?: string;
  title?: string;
  keyword?: string;
  scores?: {
    demandScore?: number;
    priceSignal?: number;
    confidenceScore?: number;
    riskScore?: number;
    opportunityScore?: number;
  };
  recommendation?: {
    action?: string;
    reasoningSummary?: string;
    nextStep?: string;
  };
  evidence?: {
    price?: number | null;
    currency?: string;
    rating?: number | null;
    reviewsCount?: number;
    boughtPastMonth?: number;
    rankOnPage?: number | null;
    sponsored?: boolean;
    sourceUrl?: string;
    imageUrl?: string;
  };
  createdAt?: Date;
};

function getArgValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value || 0)));
}

function toSignal(score: number): "weak" | "moderate" | "strong" {
  if (score >= 70) return "strong";
  if (score >= 45) return "moderate";
  return "weak";
}

function toConfidence(score: number): "low" | "medium" | "high" {
  if (score >= 75) return "high";
  if (score >= 45) return "medium";
  return "low";
}

function toRisk(score: number): "low" | "medium" | "high" {
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  return "low";
}

function cleanText(value: unknown, fallback: string, maxLength = 240): string {
  const text = typeof value === "string" && value.trim() ? value.trim() : fallback;
  return text.slice(0, maxLength);
}

function isValidUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;

  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function buildAssistantContributions() {
  return [
    {
      assistantId: "trend" as const,
      summary: "Demand was estimated from Amazon marketplace proxy signals.",
      latestContribution: "Used rating, reviews, bought-past-month, and search rank as trend proxies.",
      signalStrength: "strong" as const,
      confidence: "medium" as const,
      risk: "medium" as const,
      dataSourcesUsed: ["Amazon rating", "Amazon reviews", "Amazon bought_past_month", "Amazon search rank"],
      usageCost: 6
    },
    {
      assistantId: "competitor" as const,
      summary: "Amazon marketplace pressure was evaluated from Bright Data search results.",
      latestContribution: "Compared price, ranking, rating, review volume, and sponsorship signals.",
      signalStrength: "strong" as const,
      confidence: "high" as const,
      risk: "medium" as const,
      dataSourcesUsed: ["Bright Data Web Scraper API", "Amazon Search"],
      usageCost: 8
    },
    {
      assistantId: "supplier" as const,
      summary: "Supplier feasibility is represented with a validation-ready supplier comparison layer.",
      latestContribution: "Prepared supplier cost, delivery window, availability, match confidence, and sourcing risk checks.",
      signalStrength: "moderate" as const,
      confidence: "medium" as const,
      risk: "medium" as const,
      dataSourcesUsed: ["Supplier validation pending", "Demo supplier context"],
      usageCost: 9
    },
    {
      assistantId: "inventory" as const,
      summary: "Inventory impact is treated as pending until a connected inventory source is available.",
      latestContribution: "Marked supplier and inventory validation as the next operational step.",
      signalStrength: "moderate" as const,
      confidence: "medium" as const,
      risk: "medium" as const,
      dataSourcesUsed: ["Demo inventory context"],
      usageCost: 7
    }
  ];
}

async function connectMongo() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("Missing MONGODB_URI.");
  }

  await mongoose.connect(uri);
}

async function main() {
  const limit = Number(getArgValue("--limit") || "20");
  const workspaceIdArg = getArgValue("--workspaceId");

  await connectMongo();

  const db = mongoose.connection.db;

  if (!db) {
    throw new Error("Mongo database connection was not initialized.");
  }

  let workspaceId = workspaceIdArg || "";

  if (!workspaceId) {
    const workspace = await Workspace.findOne().lean() as { _id?: unknown } | null;

    if (!workspace?._id) {
      throw new Error("No workspace found. Register/login once first, or pass --workspaceId <id>.");
    }

    workspaceId = String(workspace._id);
  }

  const latestBrightDataRun = await db.collection("analysis_runs").findOne(
    {
      source: "brightdata",
      status: "completed"
    },
    {
      sort: { createdAt: -1 }
    }
  );

  if (!latestBrightDataRun?._id) {
    throw new Error("No completed Bright Data raw import found in analysis_runs.");
  }

  const rawOpportunities = await db
    .collection("opportunities")
    .find({ runId: latestBrightDataRun._id })
    .sort({ "scores.opportunityScore": -1 })
    .limit(limit)
    .toArray() as RawOpportunity[];

  if (!rawOpportunities.length) {
    throw new Error("No Bright Data opportunities found for the latest raw import.");
  }

  const now = new Date().toISOString();
  const analysisRunId = `brightdata-${String(latestBrightDataRun._id)}`;
  const topOpportunity = rawOpportunities[0];
  const assistantContributions = buildAssistantContributions();

  const evidencePackages = rawOpportunities.map((opportunity) => {
    const evidencePackageId = `bd-evidence-${String(opportunity._id)}`;
    const price = Math.max(0, Number(opportunity.evidence?.price || 0));
    const score = clamp(opportunity.scores?.opportunityScore || 0);
    const demandScore = clamp(opportunity.scores?.demandScore || 0);
    const riskScore = clamp(opportunity.scores?.riskScore || 0);
    const sourceUrl = opportunity.evidence?.sourceUrl;

    return {
      evidencePackageId,
      sourceMarketplace: "Amazon",
      sourceType: "marketplace_search_result",
      ...(isValidUrl(sourceUrl) ? { sourceUrl } : {}),
      brightDataProduct: "Web Scraper API" as const,
      brightDataMode: "demo_fallback" as const,
      scrapedAt: now,
      productIdentity: cleanText(opportunity.title, "Amazon product", 180),
      currentPrice: price,
      supplierPrice: 0,
      estimatedMargin: 0,
      demandIndicators: [
        `Opportunity score: ${score}/100`,
        `Demand score: ${demandScore}/100`,
        `Reviews: ${opportunity.evidence?.reviewsCount || 0}`,
        `Bought past month: ${opportunity.evidence?.boughtPastMonth || 0}`,
        `Rating: ${opportunity.evidence?.rating || "not available"}`
      ],
      socialMomentum: toSignal(demandScore),
      competitionLevel: opportunity.evidence?.sponsored ? "high" as const : "moderate" as const,
      matchQuality: toConfidence(opportunity.scores?.confidenceScore || 0),
      matchScore: score,
      matchedAttributes: ["title", "price", "rating", "reviews", "amazon_rank"],
      riskInputs: [
        `Risk score: ${riskScore}/100`,
        opportunity.evidence?.sponsored ? "Sponsored product may indicate higher competition." : "No sponsorship flag detected.",
        price === 0 ? "Missing price data." : "Price data available."
      ],
      assistantUsed: "competitor" as const
    };
  });

  const recommendations = rawOpportunities.map((opportunity) => {
    const score = clamp(opportunity.scores?.opportunityScore || 0);
    const demandScore = clamp(opportunity.scores?.demandScore || 0);
    const confidenceScore = clamp(opportunity.scores?.confidenceScore || 0);
    const riskScore = clamp(opportunity.scores?.riskScore || 0);
    const evidencePackageId = `bd-evidence-${String(opportunity._id)}`;

    return {
      recommendationId: `bd-rec-${String(opportunity._id)}`,
      analysisRunId,
      workspaceId,
      recommendedAction: cleanText(
        opportunity.recommendation?.action,
        "Evaluate this product opportunity",
        160
      ),
      opportunityScore: score,
      estimatedMargin: 0,
      demandSignal: toSignal(demandScore),
      riskLevel: toRisk(riskScore),
      confidenceLevel: toConfidence(confidenceScore),
      signalStrength: toSignal(score),
      dataFreshness: "Bright Data raw import",
      matchQuality: toConfidence(confidenceScore),
      primaryReason: cleanText(
        opportunity.recommendation?.reasoningSummary,
        "Bright Data marketplace signals indicate this product deserves review.",
        500
      ),
      suggestedNextStep: cleanText(
        opportunity.recommendation?.nextStep,
        "Validate supplier availability, delivery time, and margin before committing.",
        260
      ),
      assistantContributions,
      evidencePackageId,
      status: "new" as const,
      createdAt: now
    };
  });

  const assistantFindings = [
    {
      assistantId: "trend" as const,
      finding: "Trend strength was estimated from Amazon demand proxies such as bought-past-month, rating, review count, and rank.",
      reason: "These signals provide a practical MVP-level demand estimate without requiring social commerce data.",
      signal: "strong" as const,
      confidence: "medium" as const,
      risk: "medium" as const,
      sourceType: "marketplace_demand_proxy",
      sourceLabel: "Amazon demand signals",
      dataFreshness: "Imported raw Bright Data output"
    },
    {
      assistantId: "competitor" as const,
      finding: "Bright Data Amazon Search returned marketplace product candidates with price, rank, rating, and demand proxy signals.",
      reason: "The imported dataset provides competitor and marketplace evidence for recommendation scoring.",
      signal: "strong" as const,
      confidence: "high" as const,
      risk: "medium" as const,
      sourceType: "marketplace_search",
      sourceLabel: "Bright Data Amazon Search",
      dataFreshness: "Imported raw Bright Data output"
    },
    {
      assistantId: "supplier" as const,
      finding: "Supplier comparison is prepared as a required AMI v1.1 validation layer.",
      reason: "The imported marketplace run can rank demand, while supplier cost, delivery, and risk still need final validation.",
      signal: "moderate" as const,
      confidence: "medium" as const,
      risk: "medium" as const,
      sourceType: "supplier_context",
      sourceLabel: "Supplier validation pending",
      dataFreshness: "Demo supplier context"
    },
    {
      assistantId: "inventory" as const,
      finding: "Inventory validation is still pending because no connected inventory source was used for this imported run.",
      reason: "The system can recommend opportunities, but supplier and internal stock context must be validated before execution.",
      signal: "moderate" as const,
      confidence: "medium" as const,
      risk: "medium" as const,
      sourceType: "inventory_context",
      sourceLabel: "Demo inventory context",
      dataFreshness: "Demo context"
    }
  ];

  const marketContext = {
    productName: cleanText(topOpportunity.keyword || topOpportunity.title, "Amazon product opportunity", 140),
    category: cleanText(topOpportunity.keyword, "Marketplace products", 120),
    targetMarketplace: "Amazon",
    supplierSource: "Supplier validation pending",
    businessGoal: "discover_new_products" as const,
    region: "United States",
    currency: topOpportunity.evidence?.currency || "USD",
    useInventoryContext: false
  };

  const result = {
    analysisRunId,
    workspaceId,
    marketContext,
    status: "completed" as const,
    startedAt: latestBrightDataRun.startedAt
      ? new Date(latestBrightDataRun.startedAt).toISOString()
      : now,
    completedAt: now,
    assistantStatus: {
      trend: "completed" as const,
      competitor: "completed" as const,
      supplier: "completed" as const,
      inventory: "completed" as const,
    },
    sourceCollectionStatus: {
      brightDataProduct: "Web Scraper API",
      mode: "demo_fallback" as const,
      label: "Bright Data Amazon Search raw import",
      collectedAt: now
    },
    executiveRecommendation: recommendations[0],
    opportunities: recommendations,
    assistantFindings,
    evidencePackages,
    supplierOptions: [
      {
        supplierName: "Supplier validation pending",
        source: "Supplier validation pending",
        estimatedUnitCost: 0,
        estimatedDeliveryTime: "Validation required",
        availability: "Pending",
        ratingQualityProxy: "Pending",
        matchConfidence: "medium" as const,
        risk: "medium" as const
      }
    ],
    demoMode: true
  };

  await Promise.all([
    AnalysisRun.deleteMany({ workspaceId, "data.analysisRunId": analysisRunId }),
    RecommendationModel.deleteMany({ workspaceId, "data.analysisRunId": analysisRunId }),
    AppOpportunity.deleteMany({ workspaceId, "data.analysisRunId": analysisRunId }),
    EvidencePackageModel.deleteMany({
      workspaceId,
      "data.evidencePackageId": { $in: evidencePackages.map((item) => item.evidencePackageId) }
    }),
    AssistantRun.deleteMany({
      workspaceId,
      "data.sourceLabel": {
        $in: ["Bright Data Amazon Search", "Amazon demand signals", "Supplier validation pending", "Demo inventory context"]
      }
    }),
    RawSourceSnapshot.deleteMany({ workspaceId, "data.label": "Bright Data Amazon Search raw import" })
  ]);

  await Promise.all([
    AnalysisRun.create({ workspaceId, data: result }),
    ...assistantFindings.map((finding) => AssistantRun.create({ workspaceId, data: finding })),
    ...evidencePackages.map((evidence) => EvidencePackageModel.create({ workspaceId, data: evidence })),
    ...recommendations.map((recommendation) => AppOpportunity.create({ workspaceId, data: recommendation })),
    ...recommendations.map((recommendation) => RecommendationModel.create({ workspaceId, data: recommendation })),
    RawSourceSnapshot.create({ workspaceId, data: result.sourceCollectionStatus })
  ]);

  const usageRows = [
    {
      assistantId: "trend" as const,
      usageCount: 1,
      creditLimit: 100,
      creditsUsed: 6,
      estimatedUsageCost: 0.6,
      lastRun: now,
      latestContribution: "Estimated demand from Amazon rating, reviews, bought-past-month, and ranking signals.",
      dataSourcesUsed: ["Amazon demand proxies", "Bright Data Amazon Search"],
      alertState: "normal" as const
    },
    {
      assistantId: "competitor" as const,
      usageCount: 1,
      creditLimit: 100,
      creditsUsed: 8,
      estimatedUsageCost: 0.8,
      lastRun: now,
      latestContribution: "Compared Amazon price, ranking, rating, review volume, and marketplace pressure.",
      dataSourcesUsed: ["Bright Data Web Scraper API", "Amazon Search"],
      alertState: "normal" as const
    },
    {
      assistantId: "supplier" as const,
      usageCount: 1,
      creditLimit: 100,
      creditsUsed: 9,
      estimatedUsageCost: 0.9,
      lastRun: now,
      latestContribution: "Prepared supplier validation checks for cost, delivery, availability, and sourcing risk.",
      dataSourcesUsed: ["Supplier validation pending", "Demo supplier context"],
      alertState: "normal" as const
    },
    {
      assistantId: "inventory" as const,
      usageCount: 1,
      creditLimit: 100,
      creditsUsed: 7,
      estimatedUsageCost: 0.7,
      lastRun: now,
      latestContribution: "Marked supplier and inventory validation as the next operational step.",
      dataSourcesUsed: ["Demo inventory context"],
      alertState: "normal" as const
    }
  ];

  await Promise.all(
    usageRows.map((usage) =>
      AssistantUsageModel.findOneAndUpdate(
        { workspaceId, "data.assistantId": usage.assistantId },
        { workspaceId, data: usage },
        { upsert: true, new: true }
      )
    )
  );

  console.log("Bright Data sync completed");
  console.log(`Workspace: ${workspaceId}`);
  console.log(`Analysis run: ${analysisRunId}`);
  console.log(`Synced recommendations: ${recommendations.length}`);
  console.log(`Executive recommendation: ${recommendations[0].recommendedAction}`);
  console.log(`Top score: ${recommendations[0].opportunityScore}`);

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("Bright Data sync failed");
  console.error(error);

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  process.exit(1);
});
