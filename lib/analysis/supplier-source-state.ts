import type { AnalysisResult, SupplierSourceStatus } from "@/lib/schemas/ami";

/**
 * Canonical supplier-native source status (the Zod enum + type live alongside the
 * schema in `@/lib/schemas/ami`). Re-exported here so UI modules can import the
 * type next to the derivation helpers.
 *
 * IMPORTANT: this must be derived from the supplier-native sources that were
 * actually attempted (see {@link deriveSupplierSourceState}), NOT inferred from
 * `supplierOptions.length === 0`. An empty `supplierOptions` array can mean the
 * supplier source was never attempted, attempted-but-empty, attempted-but-failed,
 * or attempted-but-partial — these are not interchangeable.
 */
export type { SupplierSourceStatus };

/** Canonical supplier signal keys reported in `supplierMissingSignals`. */
export const SUPPLIER_SIGNAL_KEYS = {
  cost: "supplier_cost",
  delivery: "supplier_delivery",
  availability: "supplier_availability"
} as const;

/**
 * Source keys that represent supplier-native catalogs / supplier fallbacks.
 *
 * eBay is intentionally excluded: in this pipeline eBay is wired as a target
 * marketplace, and only becomes a supplier *signal* per-product inside
 * `buildSupplierOptions`. Amazon marketplace search keys (e.g.
 * `amazon_products_search`, `marketplace_search_via_web_unlocker`) are also
 * intentionally NOT matched here so marketplace collection is never mistaken
 * for a supplier-native attempt.
 */
const SUPPLIER_NATIVE_SOURCE =
  /supplier|alibaba|aliexpress|1688|dhgate|made-in-china|globalsources|indiamart|amazon_seller/i;

function supplierNativeKeys(keys: ReadonlyArray<string> | undefined): string[] {
  return (keys ?? []).filter((key) => SUPPLIER_NATIVE_SOURCE.test(key));
}

export type SupplierSourceState = {
  status: SupplierSourceStatus;
  /** Distinct supplier-native source keys that were attempted (any outcome). */
  attempted: string[];
  failed: string[];
  empty: string[];
  partial: string[];
  /** Number of supplier options that survived `buildSupplierOptions`. */
  optionCount: number;
};

type SupplierSourceInput = Pick<AnalysisResult, "supplierOptions" | "dataQualitySummary" | "rawSourceSummary">;

/**
 * Derive the supplier-native source state from signals that are already
 * persisted on the analysis result. This is offline and side-effect free — it
 * never triggers a data provider and never fabricates supplier records.
 */
export function deriveSupplierSourceState(analysis: SupplierSourceInput): SupplierSourceState {
  const quality = analysis.dataQualitySummary;
  const raw = analysis.rawSourceSummary;

  const failed = Array.from(new Set(supplierNativeKeys([...(quality?.failedSources ?? []), ...(raw?.failed ?? [])])));
  const empty = Array.from(new Set(supplierNativeKeys([...(quality?.emptySources ?? []), ...(raw?.empty ?? [])])));
  const partial = Array.from(new Set(supplierNativeKeys([...(quality?.partialSources ?? []), ...(raw?.partial ?? [])])));
  const success = supplierNativeKeys(raw?.success ?? []);
  const attempted = Array.from(new Set([...failed, ...empty, ...partial, ...success]));

  const options = analysis.supplierOptions ?? [];
  const optionCount = options.length;

  let status: SupplierSourceStatus;
  if (optionCount > 0) {
    // "success" requires a VALIDATED supplier cost. If every option is real Bright
    // Data marketplace seller data with no validated supplier cost, the coverage is
    // "marketplace_seller_data_available". Anything in between is "partial".
    const hasValidatedSupplierCost = options.some(
      (option) =>
        option.supplierCostValidated === true && option.estimatedUnitCost !== null && option.estimatedUnitCost !== undefined
    );
    const allMarketplaceSeller = options.every(
      (option) => option.isBrightDataSource === true && option.supplierCostValidated !== true
    );
    status = hasValidatedSupplierCost ? "success" : allMarketplaceSeller ? "marketplace_seller_data_available" : "partial";
  } else if (failed.length > 0) {
    status = "failed";
  } else if (partial.length > 0) {
    status = "partial";
  } else if (empty.length > 0) {
    status = "empty";
  } else {
    status = "not_attempted";
  }

  return { status, attempted, failed, empty, partial, optionCount };
}

function isKnownText(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0 && !/^unknown/i.test(value.trim());
}

/**
 * Supplier signals that are still missing for this analysis. Cost/delivery/
 * availability are reported missing whenever no supplier option carries a real
 * (non-placeholder) value. Missing cost stays missing — it is never coerced.
 */
export function supplierMissingSignals(input: Pick<AnalysisResult, "supplierOptions">): string[] {
  const options = input.supplierOptions ?? [];
  const missing: string[] = [];

  if (!options.some((option) => option.estimatedUnitCost !== null && option.estimatedUnitCost !== undefined)) {
    missing.push(SUPPLIER_SIGNAL_KEYS.cost);
  }
  if (!options.some((option) => isKnownText(option.estimatedDeliveryTime))) {
    missing.push(SUPPLIER_SIGNAL_KEYS.delivery);
  }
  if (!options.some((option) => isKnownText(option.availability))) {
    missing.push(SUPPLIER_SIGNAL_KEYS.availability);
  }

  return missing;
}

/** Human-readable explanation for the supplier source status. */
export function supplierSourceReason(state: SupplierSourceState): string {
  switch (state.status) {
    case "marketplace_seller_data_available":
      return "Marketplace seller data was collected via Bright Data. Supplier cost is not validated, so margin and ROI require supplier pricing confirmation.";
    case "success":
      return state.attempted.length
        ? `Supplier-native data collected from ${state.attempted.join(", ")}.`
        : "Supplier-native data is available for this analysis.";
    case "partial":
      return state.attempted.length
        ? `Supplier-native data from ${state.attempted.join(", ")} is partial; supplier cost, delivery, and availability still require validation.`
        : "Supplier data is partial; supplier cost, delivery, and availability still require validation.";
    case "failed":
      return `Supplier-native source(s) ${state.failed.join(", ") || "configured"} were attempted but failed to collect.`;
    case "empty":
      return `Supplier-native source(s) ${state.empty.join(", ") || "configured"} were checked but returned no supplier records.`;
    case "not_attempted":
    default:
      return "Supplier-native collection is not enabled in the current offline/no-external-call mode.";
  }
}

/** Canonical empty-state copy for each supplier source status. */
export const SUPPLIER_SOURCE_EMPTY_COPY: Record<SupplierSourceStatus, string> = {
  not_attempted: "Supplier-native source not attempted. Supplier comparison requires supplier catalog data.",
  empty: "Supplier-native source was checked, but no supplier matches were found for this analysis.",
  failed: "Supplier-native source could not be collected. Supplier comparison requires a successful supplier data run.",
  partial: "Supplier data is partial. Review supplier cost, delivery, and availability before acting.",
  marketplace_seller_data_available:
    "Marketplace seller data was collected via Bright Data. Supplier cost is not validated, so margin and ROI require supplier pricing confirmation.",
  success: "Supplier options connected to this analysis will appear here when available."
};

// Banner shown above Supplier Comparison when real Bright Data marketplace seller
// (Amazon/eBay) data exists — never claims supplier cost is validated.
export const SUPPLIER_MARKETPLACE_BANNER =
  "Marketplace seller data was collected via Bright Data. Supplier cost is not validated, so margin and ROI require supplier pricing confirmation.";

// Per-row note for real Bright Data marketplace seller rows.
export const SUPPLIER_MARKETPLACE_ROW_NOTE = "Marketplace seller data collected via Bright Data. Supplier cost is not validated.";
