import type {
  AssistantRunTrace,
  CoordinatorRunTrace,
  EvidenceTraceMetadata,
  NormalizedSourceMode,
  RawSnapshotMetadata,
  SourceProvider,
  SourceSummary
} from "@/lib/schemas/ami";

export type SourceTraceInput = {
  status?: string;
  storedMode?: string;
  usedFallback?: boolean;
  liveAttempted?: boolean;
  liveSucceeded?: boolean;
  fallbackKind?: "none" | "snapshot" | "demo_seed";
  sourceProvider?: SourceProvider;
  sourceProducts?: string[];
  rawSnapshotsSaved?: number;
  rawSnapshotsLoaded?: number;
  evidenceItemsCreated?: number;
};

export type SourceTraceState = {
  sourceMode: NormalizedSourceMode;
  fallbackUsed: boolean;
  sourceProvider: SourceProvider;
  sourceProducts: string[];
  sourceSummary: SourceSummary;
};

const LOG_FIELD_LIMIT = 180;

function clampInt(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function normalizeProducts(products: unknown) {
  if (!Array.isArray(products)) {
    return [];
  }

  return products.map((item) => String(item).trim()).filter(Boolean);
}

function redactLogValue(value: unknown) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const raw =
    typeof value === "string"
      ? value
      : typeof value === "number" || typeof value === "boolean"
        ? String(value)
        : JSON.stringify(value);
  return raw
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]")
    .replace(/(mongodb(?:\+srv)?:\/\/[^:\s]+:)[^@\s]+/gi, "$1[redacted]")
    .replace(/\s+/g, " ")
    .slice(0, LOG_FIELD_LIMIT);
}

export function amiLog(scope: string, event: string, fields: Record<string, unknown> = {}) {
  const safeFields = Object.entries(fields)
    .map(([key, value]) => [key, redactLogValue(value)] as const)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${value}`)
    .join(" ");
  const prefix = `[AMI][${scope}]`;

  console.info(`${prefix} ${event}${safeFields ? ` ${safeFields}` : ""}`);
}

export function safeTraceError(value: unknown) {
  if (value instanceof Error) {
    return redactLogValue(value.message) ?? "Unknown error";
  }

  return redactLogValue(value) ?? "Unknown error";
}

export function isSourceFallbackMode(mode: unknown) {
  return mode === "fallback_snapshot" || mode === "demo_seed" || mode === "demo_fallback" || mode === "demo_snapshot" || mode === "mixed";
}

export function sourceModeLabel(mode: unknown) {
  if (mode === "live") {
    return "Live Bright Data data";
  }

  if (mode === "fallback_snapshot") {
    return "Fallback snapshot";
  }

  if (mode === "demo_seed") {
    return "Demo seed";
  }

  if (mode === "demo_fallback" || mode === "demo_snapshot") {
    return "Demo seed";
  }

  if (mode === "mixed") {
    return "Fallback snapshot";
  }

  if (mode === "error" || mode === "not_configured") {
    return "Provider failed";
  }

  return "Pending";
}

export function normalizeSourceTrace(input: SourceTraceInput): SourceTraceState {
  const status = input.status;
  const storedMode = input.storedMode;
  const fallbackKind = input.fallbackKind ?? "none";
  const liveAttempted = Boolean(input.liveAttempted);
  const liveSucceeded = Boolean(input.liveSucceeded || status === "live" || storedMode === "live");
  const fallbackRequested = Boolean(input.usedFallback || status === "fallback" || isSourceFallbackMode(storedMode));
  const fallbackUsed = fallbackRequested || fallbackKind === "snapshot" || fallbackKind === "demo_seed";
  const sourceMode: NormalizedSourceMode =
    liveSucceeded && !fallbackUsed
      ? "live"
      : fallbackKind === "snapshot" || storedMode === "fallback_snapshot"
        ? "fallback_snapshot"
        : "demo_seed";
  const sourceProvider: SourceProvider =
    input.sourceProvider ?? (sourceMode === "live" || sourceMode === "fallback_snapshot" ? "brightdata" : "demo");
  const sourceProducts = normalizeProducts(input.sourceProducts);

  return {
    sourceMode,
    fallbackUsed,
    sourceProvider,
    sourceProducts,
    sourceSummary: {
      provider: sourceProvider,
      productsUsed: sourceProducts,
      liveAttempted,
      liveSucceeded: sourceMode === "live",
      fallbackUsed,
      rawSnapshotsSaved: clampInt(input.rawSnapshotsSaved),
      rawSnapshotsLoaded: clampInt(input.rawSnapshotsLoaded),
      evidenceItemsCreated: clampInt(input.evidenceItemsCreated)
    }
  };
}

export function extractedProductFields(product: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!product) {
    return {};
  }

  const fields: Array<[string, unknown]> = [
    ["title", product.title],
    ["price", product.price],
    ["currency", product.currency],
    ["rating", product.rating],
    ["reviews_count", product.reviewsCount],
    ["availability", product.availability],
    ["external_id", product.externalId],
    ["category", product.category],
    ["image_url", product.imageUrl],
    ["supplier_name", product.supplierName],
    ["supplier_price", product.supplierPrice],
    ["estimated_margin", product.estimatedMargin],
    ["demand_signal", product.demandSignal],
    ["price_pressure", product.pricePressure],
    ["trend_momentum", product.trendMomentum],
    ["inventory_risk", product.inventoryRisk]
  ];

  return Object.fromEntries(fields.filter(([, value]) => value !== undefined && value !== null && value !== ""));
}

export type {
  AssistantRunTrace,
  CoordinatorRunTrace,
  EvidenceTraceMetadata,
  NormalizedSourceMode,
  RawSnapshotMetadata,
  SourceProvider,
  SourceSummary
};
