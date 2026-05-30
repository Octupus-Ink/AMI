import type { MarketContextPayload } from "@/lib/schemas/ami";

const AMI_DIAG_PREFIX = "[AMI_DIAG]";

const ALLOWED_FIELDS = new Set([
  "event",
  "analysisRunId",
  "requestId",
  "briefingFingerprint",
  "businessGoal",
  "productFamily",
  "requestedProductFamily",
  "category",
  "requestedCategory",
  "targetMarketplace",
  "sourceMode",
  "mode",
  "sourceName",
  "sourceRole",
  "sourceStatus",
  "usedFallback",
  "fallbackReason",
  "abortReason",
  "startedAt",
  "completedAt",
  "createdAt",
  "durationMs",
  "route",
  "responseStatus",
  "ok",
  "isDuplicateStart",
  "existingRunFound",
  "latestRunLoaded",
  "runIdFromUrl",
  "runIdFromLocalStorage",
  "recommendationSource",
  "failedSources",
  "partialSources",
  "emptySources",
  "fallbackSources",
  "missingCriticalFields",
  "candidateTitle",
  "candidateCategory",
  "candidateSource",
  "productFamilyFit",
  "categoryFit",
  "finalMatchScore",
  "demandScore",
  "trendMomentum",
  "supplierAvailability",
  "dataQualityStatus",
  "inputKeyword",
  "normalizedKeyword",
  "recordCount",
  "errorCode",
  "errorMessage",
  "rawSourceSnapshotId",
  "runStatus",
  "pollCount"
]);

type DiagDetails = Record<string, unknown>;

function envValue(key: string) {
  if (typeof process === "undefined") {
    return undefined;
  }

  return process.env[key];
}

export function amiDiagEnabled() {
  return envValue("AMI_DIAG") === "true" || envValue("NEXT_PUBLIC_AMI_DIAG") === "true" || envValue("NODE_ENV") !== "production";
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function hashString(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

function normalizeText(value: string | undefined) {
  return value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
}

export function briefingFingerprint(context: MarketContextPayload, workspaceId?: string) {
  return hashString(stableStringify({
    workspaceId: workspaceId ?? "",
    productName: normalizeText(context.productName),
    category: normalizeText(context.category),
    targetMarketplace: normalizeText(context.targetMarketplace),
    supplierSource: normalizeText(context.supplierSource),
    businessGoal: context.businessGoal,
    region: normalizeText(context.region),
    currency: normalizeText(context.currency),
    useInventoryContext: context.useInventoryContext
  }));
}

export function briefingDiagFields(context: MarketContextPayload, workspaceId?: string) {
  return {
    briefingFingerprint: briefingFingerprint(context, workspaceId),
    businessGoal: context.businessGoal,
    productFamily: context.productName,
    requestedProductFamily: context.productName,
    category: context.category,
    requestedCategory: context.category,
    targetMarketplace: context.targetMarketplace
  };
}

export function createDiagRequestId(prefix = "req") {
  const randomPart = Math.random().toString(36).slice(2, 8);

  return `${prefix}_${Date.now().toString(36)}_${randomPart}`;
}

function safeDiagValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value.length > 240 ? `${value.slice(0, 240)}...` : value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 8).map(safeDiagValue);
  }

  return value;
}

export function amiDiagLog(event: string, details: DiagDetails = {}) {
  if (!amiDiagEnabled()) {
    return;
  }

  const safeDetails = Object.fromEntries(
    Object.entries({ event, ...details })
      .filter(([key]) => ALLOWED_FIELDS.has(key))
      .map(([key, value]) => [key, safeDiagValue(value)])
  );

  console.info(`${AMI_DIAG_PREFIX} ${JSON.stringify(safeDetails)}`);
}
