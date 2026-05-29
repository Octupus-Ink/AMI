# Bright Data Integration

AMI treats Bright Data as the primary marketplace data provider. AIMLAPI is only used after collection to analyze normalized JSON, KPIs, compact evidence summaries, and assistant context.

## Final Source Modes

Every completed analysis run returns one normalized `sourceMode`:

- `live`: live Bright Data collection succeeded and no source fallback was used.
- `fallback_snapshot`: live Bright Data was attempted, failed or produced no usable records, and AMI loaded a preserved Bright Data raw snapshot.
- `demo_seed`: no live Bright Data source was attempted or no preserved raw snapshot was available, so AMI used deterministic demo seed data.

The top-level `fallbackUsed` flag describes source fallback only. AIMLAPI or assistant fallback can still set the existing overall `usedFallback` flag.

## Run Trace Fields

Analysis responses now include:

- `sourceMode`, `fallbackUsed`, `sourceProvider`, and `sourceProducts`.
- `sourceSummary` with provider, products used, live attempt/success state, raw snapshot counts, and evidence item count.
- `rawSnapshotMetadata` linked by `runId`.
- `evidenceMetadata` with source provider, product, raw reference, extracted fields, assistant usage, confidence, and match score.
- `assistantRunTrace` for `trend`, `competitor`, `supplier`, and `inventory`.
- `coordinatorTrace` for the `ami_orchestrator` synthesis step.

Mongo persistence uses the existing collections: `analysisRuns`, `rawSourceSnapshots`, `assistantRuns`, `evidencePackages`, `opportunities`, and `recommendations`.

## Marketplace Registry

Bright Data scraper execution is resolved by marketplace plus input type:

- Amazon keyword discovery uses `BRIGHT_DATA_AMAZON_PRODUCTS_DATASET_ID` with the configured `keyword` input key.
- eBay keyword, category URL, product URL, and shop URL operations share `BRIGHT_DATA_EBAY_DATASET_ID` and switch the payload key by input type.
- Ambiguous inputs fall back to keyword mode instead of failing the run.
- Web Unlocker is a Bright Data live fallback provider. If it returns usable records, the final run remains `sourceMode=live` and `fallbackUsed=false`.

The normalized env templates are `.env.example` and `.env.normalized.example`; both use only the `BRIGHT_DATA_` prefix.

## Local Artifacts

Every analysis run writes safe local verification files under `data/ami-runs/<YYYY-MM-DD>/<runId>/`:

- `run-summary.json`
- `timeline.log`
- `brightdata-summary.json`
- `evidence-summary.json`
- `assistant-runs.json`
- `coordinator-result.json`
- `errors.log`

These artifacts are ignored by git and are not the production source of truth.

## Safe Server Logs

Server logs use safe prefixes and do not include secrets or raw HTML:

- `[AMI][RUN] RUN_CREATED`
- `[AMI][BRIGHTDATA] SCRAPER_START`
- `[AMI][BRIGHTDATA] SCRAPER_SUCCESS`
- `[AMI][BRIGHTDATA] SCRAPER_EMPTY`
- `[AMI][BRIGHTDATA] SCRAPER_FAILED`
- `[AMI][BRIGHTDATA] WEB_UNLOCKER_START`
- `[AMI][BRIGHTDATA] WEB_UNLOCKER_SUCCESS`
- `[AMI][BRIGHTDATA] FALLBACK_SNAPSHOT_LOAD`
- `[AMI][BRIGHTDATA] RAW_SNAPSHOT_SAVED`
- `[AMI][EVIDENCE] NORMALIZATION_COMPLETE`
- `[AMI][ASSISTANT] ASSISTANT_START`
- `[AMI][ASSISTANT] ASSISTANT_COMPLETE`
- `[AMI][COORDINATOR] COORDINATOR_START`
- `[AMI][COORDINATOR] COORDINATOR_COMPLETE`
- `[AMI][RUN] RUN_COMPLETE`

## UI Labels

The frontend maps source modes without changing layout:

- `live` -> `Live Bright Data data`
- `fallback_snapshot` -> `Fallback snapshot`
- `demo_seed` -> `Demo seed`

## Current Scope

The live path is Bright Data based. TikTok, AliExpress, Alibaba, and eBay are not claimed as live integrations unless a run actually returns live Bright Data evidence for those sources.
