import type { EvidenceRef } from "@/lib/schemas/agents";
import type { SourceMode, SourceProofItem } from "@/lib/schemas/ami";

export type ResolvedProviderStatus = "pending" | "live_success" | "fallback_used" | "partial_fallback" | "failed";

type SourceStateInput = {
  mode?: unknown;
  status?: unknown;
  providerStatus?: unknown;
  usedFallback?: unknown;
  fallbackUsed?: unknown;
  demoSnapshotUsed?: unknown;
  liveProviderUsed?: unknown;
  products?: unknown[];
  evidenceRefs?: Array<Partial<EvidenceRef> | Record<string, unknown>>;
  sourceProof?: SourceProofItem[];
};

export type ResolvedSourceState = {
  mode: Extract<SourceMode, "pending" | "live" | "demo" | "fallback" | "fallback_snapshot" | "demo_seed" | "demo_fallback" | "mixed" | "error">;
  providerStatus: ResolvedProviderStatus;
  fallbackUsed: boolean;
  demoSnapshotUsed: boolean;
  liveProviderUsed: boolean;
  sourceLabel: string;
  liveRecordCount: number;
  fallbackRecordCount: number;
};

const ENTITY_MAP: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: "\"",
  apos: "'",
  nbsp: " "
};

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function countEvidenceByProvider(evidenceRefs: SourceStateInput["evidenceRefs"], provider: string) {
  return (evidenceRefs ?? []).filter((item) => {
    const record = item as Record<string, unknown>;
    return readString(record.provider) === provider || readString(record.sourceType)?.toLowerCase().includes(provider);
  }).length;
}

function normalizeStoredMode(value: unknown): SourceMode | undefined {
  const mode = readString(value);

  if (
    mode === "pending" ||
    mode === "live" ||
    mode === "demo" ||
    mode === "fallback" ||
    mode === "fallback_snapshot" ||
    mode === "demo_seed" ||
    mode === "demo_fallback" ||
    mode === "mixed" ||
    mode === "error" ||
    mode === "demo_snapshot" ||
    mode === "not_configured"
  ) {
    return mode;
  }

  return undefined;
}

export function resolveSourceState(input: SourceStateInput): ResolvedSourceState {
  const storedMode = normalizeStoredMode(input.mode);
  const providerStatus = readString(input.providerStatus);
  const collectionStatus = readString(input.status);
  const explicitFallbackUsed = readBoolean(input.fallbackUsed) ?? readBoolean(input.usedFallback);
  const explicitDemoSnapshotUsed = readBoolean(input.demoSnapshotUsed);
  const explicitLiveProviderUsed = readBoolean(input.liveProviderUsed);
  const fallbackEvidenceCount = countEvidenceByProvider(input.evidenceRefs, "demo_fallback");
  const liveEvidenceCount = countEvidenceByProvider(input.evidenceRefs, "brightdata");
  const productCount = input.products?.length ?? 0;
  const sourceProof = input.sourceProof ?? [];
  const proofFallbackCount = sourceProof.filter((item) => item.isFallback).length;
  const proofLiveCount = sourceProof.filter((item) => !item.isFallback).length;
  const inferredFallbackUsed =
    storedMode === "fallback_snapshot" ||
    storedMode === "fallback" ||
    storedMode === "demo" ||
    storedMode === "demo_seed" ||
    storedMode === "demo_fallback" ||
    storedMode === "demo_snapshot" ||
    providerStatus === "fallback_used" ||
    providerStatus === "partial_fallback" ||
    collectionStatus === "fallback" ||
    fallbackEvidenceCount > 0 ||
    proofFallbackCount > 0;
  const fallbackUsed = explicitFallbackUsed === true || explicitDemoSnapshotUsed === true || inferredFallbackUsed;
  const inferredLiveProviderUsed =
    storedMode === "live" ||
    providerStatus === "live_success" ||
    collectionStatus === "live" ||
    liveEvidenceCount > 0 ||
    proofLiveCount > 0;
  const liveProviderUsed = explicitLiveProviderUsed === true || inferredLiveProviderUsed;

  if (storedMode === "fallback" || storedMode === "fallback_snapshot") {
    return {
      mode: storedMode === "fallback" ? "fallback" : "fallback_snapshot",
      providerStatus: "fallback_used",
      fallbackUsed: true,
      demoSnapshotUsed: false,
      liveProviderUsed: false,
      sourceLabel: storedMode === "fallback" ? "Fallback" : "Fallback snapshot",
      liveRecordCount: 0,
      fallbackRecordCount: fallbackEvidenceCount || proofFallbackCount || productCount
    };
  }

  if (storedMode === "demo" || storedMode === "demo_seed") {
    return {
      mode: storedMode === "demo" ? "demo" : "demo_seed",
      providerStatus: "fallback_used",
      fallbackUsed: true,
      demoSnapshotUsed: true,
      liveProviderUsed: false,
      sourceLabel: "Demo seed",
      liveRecordCount: 0,
      fallbackRecordCount: fallbackEvidenceCount || proofFallbackCount || productCount
    };
  }

  if (fallbackUsed && liveProviderUsed) {
    return {
      mode: "mixed",
      providerStatus: "partial_fallback",
      fallbackUsed: true,
      demoSnapshotUsed: true,
      liveProviderUsed: true,
      sourceLabel: "Mixed source",
      liveRecordCount: liveEvidenceCount || proofLiveCount || productCount,
      fallbackRecordCount: fallbackEvidenceCount || proofFallbackCount
    };
  }

  if (fallbackUsed) {
    return {
      mode: "demo_fallback",
      providerStatus: "fallback_used",
      fallbackUsed: true,
      demoSnapshotUsed: true,
      liveProviderUsed: false,
      sourceLabel: "Demo seed",
      liveRecordCount: 0,
      fallbackRecordCount: fallbackEvidenceCount || proofFallbackCount || productCount
    };
  }

  if (liveProviderUsed) {
    return {
      mode: "live",
      providerStatus: "live_success",
      fallbackUsed: false,
      demoSnapshotUsed: false,
      liveProviderUsed: true,
      sourceLabel: "Live",
      liveRecordCount: liveEvidenceCount || proofLiveCount || productCount,
      fallbackRecordCount: 0
    };
  }

  if (
    storedMode === "error" ||
    storedMode === "not_configured" ||
    providerStatus === "failed" ||
    collectionStatus === "error" ||
    collectionStatus === "not_configured" ||
    collectionStatus === "disabled"
  ) {
    return {
      mode: "error",
      providerStatus: "failed",
      fallbackUsed: false,
      demoSnapshotUsed: false,
      liveProviderUsed: false,
      sourceLabel: "Provider failed",
      liveRecordCount: 0,
      fallbackRecordCount: 0
    };
  }

  return {
    mode: "pending",
    providerStatus: "pending",
    fallbackUsed: false,
    demoSnapshotUsed: false,
    liveProviderUsed: false,
    sourceLabel: "Checking provider",
    liveRecordCount: 0,
    fallbackRecordCount: 0
  };
}

export function toHttpSourceUrl(value: unknown) {
  const raw = readString(value);

  if (!raw || !/^https?:\/\//i.test(raw)) {
    return null;
  }

  try {
    const parsed = new URL(raw);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function decodeBasicEntities(value: string) {
  return value
    .replace(/&([a-z]+);/gi, (match, entity: string) => ENTITY_MAP[entity.toLowerCase()] ?? match)
    .replace(/&#(\d+);/g, (match, code: string) => {
      const parsed = Number(code);
      return Number.isFinite(parsed) ? String.fromCharCode(parsed) : match;
    });
}

function looksLikeJavascriptNoise(value: string) {
  const lower = value.toLowerCase();
  const patterns = [
    "<script",
    "</script",
    "var ",
    "function ",
    "function(",
    "=>",
    "document.",
    "window.",
    "new date(",
    "apage",
    "__next_data__",
    "addeventlistener("
  ];
  const hits = patterns.filter((pattern) => lower.includes(pattern)).length;
  const semicolons = (value.match(/;/g) ?? []).length;
  const braces = (value.match(/[{}]/g) ?? []).length;
  const words = value.split(/\s+/).filter(Boolean).length;

  return hits >= 2 || (hits >= 1 && semicolons >= 2) || semicolons + braces > Math.max(10, words);
}

export function sanitizeEvidenceSnippet(value: unknown, maxLength = 260) {
  const raw = readString(value);

  if (!raw) {
    return null;
  }

  if (looksLikeJavascriptNoise(raw)) {
    return null;
  }

  const withoutBlocks = raw
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ");
  const decoded = decodeBasicEntities(withoutBlocks);
  const withoutTags = decoded.replace(/<[^>]+>/g, " ");
  const withoutInlineNoise = withoutTags
    .split(/\r?\n/)
    .filter((line) => !looksLikeJavascriptNoise(line))
    .join(" ");
  const cleaned = withoutInlineNoise.replace(/\s+/g, " ").trim();

  if (!cleaned || looksLikeJavascriptNoise(cleaned)) {
    return null;
  }

  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength - 3).trimEnd()}...` : cleaned;
}

export function sanitizeEvidenceTitle(value: unknown, fallback = "Evidence item") {
  return sanitizeEvidenceSnippet(value, 120) ?? fallback;
}

function sourceTypeForEvidence(provider: unknown, sourceType: unknown): SourceProofItem["sourceType"] {
  const providerText = readString(provider)?.toLowerCase();
  const sourceTypeText = readString(sourceType)?.toLowerCase();
  const combined = `${providerText ?? ""} ${sourceTypeText ?? ""}`;

  if (combined.includes("brightdata") || combined.includes("bright data")) {
    return "brightdata";
  }

  if (combined.includes("fallback") || combined.includes("demo")) {
    return "demo_fallback";
  }

  if (combined.includes("manual")) {
    return "manual";
  }

  if (providerText) {
    return "provider";
  }

  return "unknown";
}

function proofModeFor(mode: ResolvedSourceState["mode"], isFallback: boolean): SourceProofItem["sourceMode"] {
  if (mode === "mixed") {
    return "mixed";
  }

  if (mode === "fallback" || mode === "fallback_snapshot") {
    return "fallback_snapshot";
  }

  if (mode === "demo" || mode === "demo_seed") {
    return "demo_seed";
  }

  return isFallback ? "demo_fallback" : "live";
}

export function normalizeVisibleEvidenceItems(
  evidenceRefs: Array<Partial<EvidenceRef> | Record<string, unknown>> | undefined,
  sourceState: Pick<ResolvedSourceState, "mode" | "fallbackUsed">,
  collectedAt?: string
): SourceProofItem[] {
  return (evidenceRefs ?? []).map((item) => {
    const record = item as Record<string, unknown>;
    const sourceType = sourceTypeForEvidence(record.provider, record.sourceType);
    const isFallback =
      Boolean(record.isFallback) ||
      sourceState.fallbackUsed ||
      sourceType === "demo_fallback" ||
      readString(record.sourceType)?.toLowerCase().includes("fallback") === true;

    return {
      title: sanitizeEvidenceTitle(record.label ?? record.title ?? record.sourceType),
      sourceType,
      sourceMode: proofModeFor(sourceState.mode, isFallback),
      sourceUrl: toHttpSourceUrl(record.url ?? record.sourceUrl ?? record.productUrl ?? record.marketplaceUrl),
      collectedAt: readString(record.collectedAt) ?? collectedAt ?? new Date().toISOString(),
      snippet: sanitizeEvidenceSnippet(record.snippet),
      isFallback
    };
  });
}
