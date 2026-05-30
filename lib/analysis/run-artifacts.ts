import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { AnalysisResult } from "@/lib/schemas/ami";

const ARTIFACT_ROOT = "data/ami-runs";
const TMP_ROOT = "/tmp/ami-runs";
const MAX_TEXT = 500;

/**
 * Storage mode for run artifacts:
 * - "local-filesystem": writes to data/ami-runs (local dev only)
 * - "tmp-only": writes to /tmp/ami-runs (Vercel or read-only FS — not durable)
 * - "mongodb": skips filesystem entirely; MongoDB via saveAnalysisResult() is the source of truth
 *
 * Vercel sets VERCEL=1 automatically. When that is present and MONGODB_URI is configured,
 * filesystem writes are skipped entirely — MongoDB handles persistence.
 * When VERCEL=1 but MONGODB_URI is absent (demo), we skip silently rather than crash.
 */
function resolveStorageMode(): "local-filesystem" | "tmp-only" | "mongodb" {
  const isVercel = Boolean(process.env.VERCEL);
  const hasMongo = Boolean(process.env.MONGODB_URI);

  if (!isVercel) return "local-filesystem";
  if (hasMongo) return "mongodb";
  return "tmp-only";
}

const STORAGE_MODE = resolveStorageMode();

// Log storage mode once at module load (not on every write, avoids log spam).
console.log(`[run-artifacts] storage-mode=${STORAGE_MODE}`);

function redact(value: unknown): unknown {
  if (typeof value === "string") {
    return value
      .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]")
      .replace(/(mongodb(?:\+srv)?:\/\/[^:\s]+:)[^@\s]+/gi, "$1[redacted]")
      .replace(/sk-[A-Za-z0-9_-]+/g, "sk-[redacted]")
      .slice(0, MAX_TEXT);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redact(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, redact(item)]));
  }

  return value;
}

function writeJson(path: string, value: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(redact(value), null, 2)}\n`, "utf8");
}

function writeText(path: string, lines: string[]) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${lines.map((line) => String(redact(line))).join("\n")}\n`, "utf8");
}

function artifactDir(result: AnalysisResult, root: string) {
  const date = (result.startedAt || new Date().toISOString()).slice(0, 10);
  return join(root, date, result.analysisRunId);
}

export function writeRunArtifacts(result: AnalysisResult) {
  if (STORAGE_MODE === "mongodb") {
    // MongoDB persistence is handled by saveAnalysisResult() in the route.
    // No filesystem writes needed on Vercel.
    return;
  }

  const root = STORAGE_MODE === "tmp-only" ? TMP_ROOT : join(process.cwd(), ARTIFACT_ROOT);
  const dir = artifactDir(result, root);

  try {
    const source = {
      runId: result.analysisRunId,
      status: result.status,
      sourceMode: result.sourceMode,
      fallbackUsed: result.fallbackUsed,
      sourceProvider: result.sourceProvider,
      sourceProducts: result.sourceProducts,
      sourceSummary: result.sourceSummary,
      rawSourceSummary: result.rawSourceSummary,
      dataQualitySummary: result.dataQualitySummary,
      sourceCollectionStatus: {
        brightDataProduct: result.sourceCollectionStatus.brightDataProduct,
        providerStatus: result.sourceCollectionStatus.providerStatus,
        sourceLabel: result.sourceCollectionStatus.sourceLabel,
        liveRecordCount: result.sourceCollectionStatus.liveRecordCount,
        fallbackRecordCount: result.sourceCollectionStatus.fallbackRecordCount,
        fallbackReason: result.sourceCollectionStatus.fallbackReason
      }
    };
    const timeline = [
      `${result.startedAt} RUN_CREATED runId=${result.analysisRunId}`,
      `${result.sourceCollectionStatus.collectedAt} SOURCE_COLLECTION mode=${result.sourceMode} fallbackUsed=${result.fallbackUsed}`,
      `${result.completedAt ?? new Date().toISOString()} RUN_STATUS status=${result.status}`,
      ...(result.completedAt ? [`${result.completedAt} RUN_COMPLETE sourceMode=${result.sourceMode} fallbackUsed=${result.fallbackUsed}`] : [])
    ];
    const errors = [result.fallbackReason, ...result.warnings].filter((item): item is string => Boolean(item));

    writeJson(join(dir, "run-summary.json"), {
      runId: result.analysisRunId,
      workspaceId: result.workspaceId,
      status: result.status,
      startedAt: result.startedAt,
      completedAt: result.completedAt,
      sourceMode: result.sourceMode,
      fallbackUsed: result.fallbackUsed,
      marketContext: result.marketContext
    });
    writeText(join(dir, "timeline.log"), timeline);
    writeJson(join(dir, "brightdata-summary.json"), source);
    writeJson(join(dir, "evidence-summary.json"), {
      evidenceMetadata: result.evidenceMetadata,
      evidencePackages: result.evidencePackages.map((item) => ({
        evidencePackageId: item.evidencePackageId,
        sourceProvider: item.sourceProvider,
        sourceProduct: item.sourceProduct,
        sourceName: item.sourceName,
        sourceMode: item.sourceMode,
        url: item.url,
        sourceUrl: item.sourceUrl,
        productUrl: item.productUrl,
        supplierUrl: item.supplierUrl,
        marketplaceUrl: item.marketplaceUrl,
        rawSourceSnapshotId: item.rawSourceSnapshotId,
        rawRef: item.rawRef,
        title: item.title ?? item.productIdentity,
        price: item.price ?? item.currentPrice,
        extractedFields: item.extractedFields
      })),
      recommendationLinks: result.recommendations.map((item) => ({
        recommendationId: item.recommendationId,
        primarySourceUrl: item.primarySourceUrl,
        evidenceLinks: item.evidenceLinks,
        sourceUrls: item.sourceUrls
      }))
    });
    writeJson(join(dir, "assistant-runs.json"), result.assistantRunTrace);
    writeJson(join(dir, "orchestrator-result.json"), result.coordinatorTrace ?? result.finalVerdict ?? {});
    writeText(join(dir, "errors.log"), errors.length ? errors : ["No errors recorded."]);
  } catch (err) {
    // Never let artifact writes crash the analysis. Log and continue.
    console.warn(`[run-artifacts] Failed to write artifacts (storage-mode=${STORAGE_MODE}):`, err instanceof Error ? err.message : err);
  }
}
