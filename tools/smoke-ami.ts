import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { runAmiAnalysis } from "../lib/ami/analysis";
import { collectBrightDataEvidence, getBrightDataConfig, validateBrightDataEnv } from "../lib/data-providers/brightdata/client";
import { callAimlapiJson, getAimlapiConfig, validateAimlapiEnv } from "../lib/llm-providers/aimlapi/client";
import type { MarketContextPayload } from "../lib/schemas/ami";

const sampleBriefing: MarketContextPayload = {
  productName: "Insulated stainless steel tumbler",
  category: "Drinkware",
  targetMarketplace: "Amazon",
  supplierSource: "Alibaba",
  businessGoal: "discover_new_products",
  region: "United States",
  currency: "USD",
  useInventoryContext: false
};

function loadEnvFile(fileName: string) {
  const filePath = resolve(process.cwd(), fileName);

  if (!existsSync(filePath)) {
    return;
  }

  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [key, ...rest] = trimmed.split("=");
    const value = rest.join("=").trim().replace(/^["']|["']$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function yesNo(value: boolean) {
  return value ? "yes" : "no";
}

function configureSmokeTimeouts() {
  process.env.BRIGHT_DATA_TIMEOUT_MS = process.env.BRIGHT_DATA_TIMEOUT_MS || "8000";
  process.env.AIMLAPI_TIMEOUT_MS = process.env.AIMLAPI_TIMEOUT_MS || "12000";
}

async function envSmoke() {
  const brightData = validateBrightDataEnv();
  const aimlapi = validateAimlapiEnv();

  console.log(`AIMLAPI configured: ${yesNo(aimlapi.configured)}`);
  console.log(`Bright Data configured: ${yesNo(brightData.configured)}`);
  console.log(`MongoDB configured: ${yesNo(Boolean(process.env.MONGODB_URI?.trim()))}`);
  console.log(`Fallback enabled: ${yesNo((process.env.AMI_ALLOW_DEMO_FALLBACK ?? "true").toLowerCase() === "true")}`);
}

async function aimlapiSmoke() {
  const config = getAimlapiConfig();
  const schema = z.object({
    ok: z.boolean(),
    summary: z.string()
  });
  const result = await callAimlapiJson(schema, {
    model: config.agentModel,
    system: "Return a tiny JSON smoke-test response.",
    user: { task: "Return ok true and a short summary." },
    temperature: 0
  });

  console.log(`AIMLAPI status: ${result.status}`);
  console.log(`Model used: ${result.model}`);
  console.log(`Valid JSON response: ${yesNo(Boolean(result.output))}`);

  if (result.safeError) {
    console.log(`Safe error: ${result.safeError}`);
  }
}

async function brightDataSmoke() {
  const result = await collectBrightDataEvidence(sampleBriefing);

  console.log(`Bright Data provider status: ${result.status}`);
  console.log(`Bright Data product: ${result.brightDataProduct}`);
  console.log(`Used fallback: ${yesNo(result.usedFallback)}`);
  console.log(`Fallback kind: ${result.fallbackKind}`);
  console.log(`Source provider: ${result.sourceProvider}`);
  console.log(`Source products: ${result.sourceProducts.join(", ") || "none"}`);
  console.log(`Raw snapshots loaded: ${result.rawSnapshotsLoaded}`);
  console.log(`Products returned: ${result.products.length}`);
  console.log(`Max cap respected: ${yesNo(result.products.length <= getBrightDataConfig().maxResults && result.products.length <= 5)}`);

  if (result.fallbackReason) {
    console.log(`Safe fallback reason: ${result.fallbackReason}`);
  }
}

async function analysisSmoke() {
  const result = await runAmiAnalysis("smoke-workspace", sampleBriefing, {
    requested: false,
    available: false
  });

  console.log(`Analysis run created: ${yesNo(Boolean(result.analysisRunId))}`);
  console.log(`Final status: ${result.status}`);
  console.log(`Source mode: ${result.sourceMode}`);
  console.log(`Bright Data attempted first: ${yesNo(Boolean(result.sourceCollectionStatus.providerStatus))}`);
  console.log(`Products analyzed: ${result.normalizedProducts.length}`);
  console.log(`Product cap respected: ${yesNo(result.normalizedProducts.length <= 5)}`);
  console.log(`Graph data generated: ${yesNo(Boolean(result.graphData))}`);
  console.log(`Final verdict generated: ${yesNo(Boolean(result.finalVerdict))}`);
  console.log(`External action payload generated: ${yesNo(Boolean(result.externalActionPayload))}`);
  console.log(`Fallback used: ${yesNo(result.usedFallback)}`);

  if (result.warnings.length) {
    console.log(`Safe warning: ${result.warnings[0]}`);
  }
}

async function fallbackSmoke() {
  const original = {
    brightDataKey: process.env.BRIGHT_DATA_API_KEY,
    aimlapiKey: process.env.AIMLAPI_API_KEY,
    allowFallback: process.env.AMI_ALLOW_DEMO_FALLBACK
  };

  process.env.BRIGHT_DATA_API_KEY = "";
  process.env.AIMLAPI_API_KEY = "";
  process.env.AMI_ALLOW_DEMO_FALLBACK = "true";

  try {
    const result = await runAmiAnalysis("smoke-fallback-workspace", sampleBriefing, {
      requested: false,
      available: false
    });

  console.log(`Fallback status: ${result.status}`);
  console.log(`Source mode: ${result.sourceMode}`);
  console.log(`Fallback used: ${yesNo(result.usedFallback)}`);
    console.log(`Fallback reason present: ${yesNo(Boolean(result.fallbackReason || result.warnings[0]))}`);
    console.log(`UI-safe graph data: ${yesNo(Boolean(result.graphData))}`);
    console.log(`UI-safe verdict: ${yesNo(Boolean(result.finalVerdict))}`);
  } finally {
    process.env.BRIGHT_DATA_API_KEY = original.brightDataKey;
    process.env.AIMLAPI_API_KEY = original.aimlapiKey;
    process.env.AMI_ALLOW_DEMO_FALLBACK = original.allowFallback;
  }
}

async function main() {
  loadEnvFile(".env.local");
  loadEnvFile(".env");
  configureSmokeTimeouts();

  const command = process.argv[2] ?? "env";

  if (command === "env") {
    await envSmoke();
    return;
  }

  if (command === "aimlapi") {
    await aimlapiSmoke();
    return;
  }

  if (command === "brightdata") {
    await brightDataSmoke();
    return;
  }

  if (command === "analysis") {
    await analysisSmoke();
    return;
  }

  if (command === "fallback") {
    await fallbackSmoke();
    return;
  }

  throw new Error(`Unknown smoke command: ${command}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown smoke failure";
  console.error(`Smoke test failed: ${message}`);
  process.exitCode = 1;
});
