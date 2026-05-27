import fs from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";
import { loadEnvConfig } from "@next/env";

import AnalysisRun from "../models/AnalysisRun";
import RawMarketplaceRecord from "../models/RawMarketplaceRecord";
import NormalizedProduct from "../models/NormalizedProduct";
import Opportunity from "../models/Opportunity";
import AssistantOutput from "../models/AssistantOutput";

import {
  normalizeAmazonSearchRecord,
  type AmazonSearchRawRecord,
} from "../lib/ami/normalizers/amazon-search";
import { scoreOpportunity } from "../lib/ami/scoring/opportunity-scoring";

loadEnvConfig(process.cwd());

const DEFAULT_RAW_FILE =
  "data/brightdata/raw/amazon/search/2026-05-27-amazon-products-search.raw.json";

async function connectMongo() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("Missing MONGODB_URI. Add it to .env or .env.local.");
  }

  if (mongoose.connection.readyState === 1) {
    return;
  }

  await mongoose.connect(uri);
}

function getArgValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

async function main() {
  const rawFileArg = getArgValue("--file");
  const shouldReset = process.argv.includes("--reset");

  const rawFile = rawFileArg || DEFAULT_RAW_FILE;
  const absoluteRawFile = path.resolve(process.cwd(), rawFile);

  console.log("AMI Bright Data import");
  console.log(`Raw file: ${rawFile}`);
  console.log(`Reset: ${shouldReset ? "yes" : "no"}`);

  await connectMongo();

  if (shouldReset) {
    console.log("Cleaning previous records for this source file...");

    const previousRuns = await AnalysisRun.find({ sourceFile: rawFile }).select(
      "_id"
    );

    const previousRunIds = previousRuns.map((run) => run._id);

    if (previousRunIds.length > 0) {
      await Promise.all([
        RawMarketplaceRecord.deleteMany({ runId: { $in: previousRunIds } }),
        NormalizedProduct.deleteMany({ runId: { $in: previousRunIds } }),
        Opportunity.deleteMany({ runId: { $in: previousRunIds } }),
        AssistantOutput.deleteMany({ runId: { $in: previousRunIds } }),
        AnalysisRun.deleteMany({ _id: { $in: previousRunIds } }),
      ]);
    }

    console.log(`Removed previous runs: ${previousRunIds.length}`);
  }

  const fileContent = await fs.readFile(absoluteRawFile, "utf8");
  const parsed = JSON.parse(fileContent);

  if (!Array.isArray(parsed)) {
    throw new Error("Expected the raw Bright Data file to contain a JSON array.");
  }

  const records = parsed as AmazonSearchRawRecord[];

  const analysisRun = await AnalysisRun.create({
    runType: "brightdata_raw_import",
    source: "brightdata",
    sourceFile: rawFile,
    status: "running",
    startedAt: new Date(),
    summary: {
      totalRawRecords: records.length,
      normalizedProducts: 0,
      opportunities: 0,
      averageOpportunityScore: 0,
      topOpportunityTitle: "",
    },
  });

  let normalizedCount = 0;
  let opportunityCount = 0;
  let scoreTotal = 0;
  let topOpportunityTitle = "";
  let topOpportunityScore = -1;

  for (const record of records) {
    const rawDoc = await RawMarketplaceRecord.create({
      runId: analysisRun._id,
      source: "amazon",
      sourceType: "amazon_products_search",
      sourceFile: rawFile,
      externalId: record.asin || record.url || "",
      input: record.input || null,
      rawData: record,
      status: record.error_code ? "error" : "success",
      errorCode: record.error_code || "",
      fetchedAt: record.timestamp ? new Date(record.timestamp) : new Date(),
    });

    const normalized = normalizeAmazonSearchRecord(
      record,
      analysisRun._id,
      rawDoc._id
    );

    if (!normalized) {
      continue;
    }

    const normalizedDoc = await NormalizedProduct.create(normalized);
    normalizedCount++;

    const score = scoreOpportunity(normalized);

    await Opportunity.create({
      runId: analysisRun._id,
      productRef: normalizedDoc._id,
      source: normalized.source,
      externalId: normalized.externalId,
      title: normalized.canonicalTitle,
      keyword: normalized.keyword,
      scores: {
        demandScore: score.demandScore,
        priceSignal: score.priceSignal,
        confidenceScore: score.confidenceScore,
        riskScore: score.riskScore,
        opportunityScore: score.opportunityScore,
      },
      recommendation: {
        action: score.action,
        reasoningSummary: score.reasoningSummary,
        nextStep: score.nextStep,
      },
      evidence: {
        price: normalized.price.current,
        currency: normalized.price.currency,
        rating: normalized.marketSignals.rating,
        reviewsCount: normalized.marketSignals.reviewsCount,
        boughtPastMonth: normalized.marketSignals.boughtPastMonth,
        rankOnPage: normalized.marketSignals.rankOnPage,
        sponsored: normalized.marketSignals.sponsored,
        sourceUrl: normalized.sourceUrl,
        imageUrl: normalized.media.imageUrl,
      },
    });

    opportunityCount++;
    scoreTotal += score.opportunityScore;

    if (score.opportunityScore > topOpportunityScore) {
      topOpportunityScore = score.opportunityScore;
      topOpportunityTitle = normalized.canonicalTitle;
    }
  }

  await AssistantOutput.insertMany([
    {
      runId: analysisRun._id,
      assistantId: "competitor",
      assistantName: "Competitor Assistant",
      status: "completed",
      sourceUsed: ["Bright Data Amazon Search"],
      contributionSummary:
        "Reviewed Amazon marketplace search results to identify pricing pressure, ranking position, and competitor product density.",
      signals: {
        source: "amazon",
        recordsReviewed: records.length,
        normalizedProducts: normalizedCount,
      },
      usage: {
        usageCount: 1,
        estimatedCost: 0,
        creditFootprint: "low",
      },
    },
    {
      runId: analysisRun._id,
      assistantId: "trend",
      assistantName: "Trend Assistant",
      status: "completed",
      sourceUsed: ["Amazon bought_past_month", "Amazon reviews", "Amazon rating"],
      contributionSummary:
        "Used Amazon demand proxies such as bought past month, rating, reviews, and search ranking to estimate product momentum.",
      signals: {
        demandProxy: "amazon_marketplace_signals",
      },
      usage: {
        usageCount: 1,
        estimatedCost: 0,
        creditFootprint: "low",
      },
    },
    {
      runId: analysisRun._id,
      assistantId: "supplier",
      assistantName: "Supplier Assistant",
      status: "simulated",
      sourceUsed: ["Alibaba/AliExpress schema planning"],
      contributionSummary:
        "Supplier comparison is prepared as an MVP extension. Current run marks supplier validation as the recommended next step.",
      signals: {
        supplierRuntime: "planned",
      },
      usage: {
        usageCount: 0,
        estimatedCost: 0,
        creditFootprint: "none",
      },
    },
    {
      runId: analysisRun._id,
      assistantId: "inventory",
      assistantName: "Inventory Assistant",
      status: "simulated",
      sourceUsed: ["Demo inventory context"],
      contributionSummary:
        "Inventory context is simulated for this import. Future runs can combine marketplace signals with connected inventory data.",
      signals: {
        inventoryRuntime: "demo",
      },
      usage: {
        usageCount: 0,
        estimatedCost: 0,
        creditFootprint: "none",
      },
    },
  ]);

  const averageOpportunityScore =
    opportunityCount > 0 ? Math.round(scoreTotal / opportunityCount) : 0;

  await AnalysisRun.updateOne(
    { _id: analysisRun._id },
    {
      status: "completed",
      completedAt: new Date(),
      summary: {
        totalRawRecords: records.length,
        normalizedProducts: normalizedCount,
        opportunities: opportunityCount,
        averageOpportunityScore,
        topOpportunityTitle,
      },
    }
  );

  console.log("Import completed");
  console.log(`Raw records: ${records.length}`);
  console.log(`Normalized products: ${normalizedCount}`);
  console.log(`Opportunities: ${opportunityCount}`);
  console.log(`Average opportunity score: ${averageOpportunityScore}`);
  console.log(`Top opportunity: ${topOpportunityTitle}`);

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("Import failed");
  console.error(error);

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  process.exit(1);
});
