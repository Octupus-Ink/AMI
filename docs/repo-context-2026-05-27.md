# AMI Repo Context - 2026-05-27

## Revision Cut

- Branch reviewed: `dev-dany`
- Current head reviewed: `76be30a Add Bright Data sync script`
- Comparison used for this context: `origin/main..HEAD`
- Working tree at review time: clean

This context captures the new Bright Data and AMI pipeline work added after the base app scaffold and the latest documented Bright Data sample commit.

## What Was Added

### Bright Data raw evidence

The repo now includes organized Bright Data outputs under `data/brightdata/raw`.

Core MVP files:

- `data/brightdata/raw/amazon/search/2026-05-27-amazon-products-search.raw.json`
  - 262 Amazon search records.
  - Current primary input for AMI import, normalization, and opportunity scoring.
- `data/brightdata/raw/amazon/product-detail/2026-05-27-amazon-product-detail-asus-rog-strix-g16.raw.json`
  - 1 product detail record.
  - Used as validated product-detail evidence.
- `data/brightdata/raw/amazon/global-dataset/2026-05-27-amazon-global-dataset-sample.raw.json`
  - 4 sample records.
  - Optional Amazon enrichment sample.
- `data/brightdata/raw/ebay/product-detail/2026-05-27-ebay-product-detail-sample.raw.json`
  - 3 sample records.
  - Optional competitor-marketplace sample.

Failed or optional runtime captures are kept as evidence in:

- `data/brightdata/raw/amazon/errors`
- `data/brightdata/raw/aliexpress/errors`
- `data/brightdata/raw/tiktok/errors`

Current MVP decision from docs: Amazon Search, Amazon Product Detail, and Web Unlocker are the validated Bright Data path. AliExpress, TikTok, and eBay remain optional or future enrichment sources.

### Bright Data organization script

`tools/organize-brightdata-json.ps1` was added to move downloaded JSON files from `brightdata-downloads` into the repo's Bright Data raw-data structure.

It classifies files by payload shape and error metadata, including:

- Amazon search results
- Amazon product detail and global dataset samples
- eBay product detail samples
- AliExpress runtime failures
- TikTok runtime failures
- Amazon invalid-ASIN failures
- Unclassified Bright Data outputs

### Raw import pipeline

`tools/import-brightdata-raw.ts` imports the Amazon search raw JSON file into MongoDB.

Default input:

```bash
npx tsx tools/import-brightdata-raw.ts
```

Optional reset:

```bash
npx tsx tools/import-brightdata-raw.ts --reset
```

Optional file override:

```bash
npx tsx tools/import-brightdata-raw.ts --file data/brightdata/raw/amazon/search/2026-05-27-amazon-products-search.raw.json
```

It creates records in these new raw-pipeline collections:

- `analysis_runs`
- `raw_marketplace_records`
- `normalized_products`
- `opportunities`
- `assistant_outputs`

Important requirement: `MONGODB_URI` must be configured in `.env` or `.env.local`.

### Raw-pipeline Mongoose models

New Mongoose models were added in `models/`:

- `AnalysisRun.ts`
  - Tracks Bright Data raw import runs, source file, status, summary counts, and top opportunity.
- `RawMarketplaceRecord.ts`
  - Stores original Bright Data records and raw fetch status.
- `NormalizedProduct.ts`
  - Stores AMI-ready product fields such as canonical title, price, market signals, media, and data quality.
- `Opportunity.ts`
  - Stores scored opportunities generated from normalized products.
- `AssistantOutput.ts`
  - Stores assistant contribution summaries for import runs.

These are separate from the existing app-facing generic models in `models/ami.ts`.

### Amazon Search normalizer

`lib/ami/normalizers/amazon-search.ts` converts raw Amazon search rows into normalized product records.

Fields normalized include:

- title/name
- source URL
- ASIN or URL external ID
- brand
- keyword
- current and original price
- currency
- rating
- review count
- bought-past-month demand proxy
- rank on page
- sponsorship flag
- Prime/coupon flags
- image URL
- data-quality flags

Records without a title or source URL are skipped.

### Opportunity scoring

`lib/ami/scoring/opportunity-scoring.ts` scores each normalized product.

Scores produced:

- `demandScore`
- `priceSignal`
- `confidenceScore`
- `riskScore`
- `opportunityScore`

Scoring inputs:

- bought-past-month volume
- review count
- rating
- page rank
- price availability and price band
- original-price discount
- sponsorship flag
- image availability

Actions generated:

- `Prioritize for sourcing review`
- `Evaluate supplier options`
- `Keep as secondary opportunity`
- `Monitor this product`

### App-facing Bright Data sync script

`tools/sync-brightdata-to-ami-result.ts` was added after the raw import work.

Purpose:

1. Finds the latest completed raw Bright Data import in `analysis_runs`.
2. Reads top scored rows from the raw-pipeline `opportunities` collection.
3. Converts them into the app-facing `AnalysisResult` structure used by the Recommendations UI.
4. Writes app-facing records through `models/ami.ts` collections:
   - `analysisRuns`
   - `assistantRuns`
   - `evidencePackages`
   - `opportunities`
   - `recommendations`
   - `rawSourceSnapshots`
   - `assistantUsage`
5. Deletes prior synced records for the same generated analysis run before writing replacements.

Example:

```bash
npx tsx tools/sync-brightdata-to-ami-result.ts --limit 20
```

Optional workspace override:

```bash
npx tsx tools/sync-brightdata-to-ami-result.ts --workspaceId <workspace_id> --limit 20
```

If no workspace ID is passed, the script uses the first workspace found in MongoDB. A registered/login-created workspace must exist first.

### Recommendations page adjustment

`app/recommendations/page.tsx` now renders `RecommendationsClient` inside `AppShell`.

This aligns the route with the app-facing recommendation data created by either:

- normal app analysis flow via `/api/analysis/start`
- the new Bright Data sync script

### Dependency added

`tsx` was added as a dev dependency so TypeScript scripts under `tools/` can run directly.

The package scripts were not expanded yet; script execution currently uses `npx tsx ...`.

## Current Data Flow

```text
Bright Data raw JSON
  -> tools/organize-brightdata-json.ps1
  -> data/brightdata/raw
  -> tools/import-brightdata-raw.ts
  -> raw_marketplace_records
  -> normalized_products
  -> opportunities
  -> assistant_outputs
  -> tools/sync-brightdata-to-ami-result.ts
  -> app-facing analysisRuns / recommendations / evidencePackages
  -> AMI Recommendations UI
```

The existing app flow still exists separately:

```text
Market Context Setup
  -> /api/analysis/start
  -> lib/ami/analysis.ts
  -> Bright Data wrapper or demo fallback
  -> saveAnalysisResult
  -> Recommendations UI
```

## Important Architectural Note

There are now two model layers using different collection naming conventions:

1. Raw Bright Data import layer:
   - `models/AnalysisRun.ts` -> `analysis_runs`
   - `models/RawMarketplaceRecord.ts` -> `raw_marketplace_records`
   - `models/NormalizedProduct.ts` -> `normalized_products`
   - `models/Opportunity.ts` -> `opportunities`
   - `models/AssistantOutput.ts` -> `assistant_outputs`

2. App-facing AMI layer:
   - `models/ami.ts` -> collections such as `analysisRuns`, `recommendations`, `evidencePackages`, `assistantUsage`

The sync script bridges these two layers. Future changes should avoid assuming that the raw import collections and app UI collections are the same data contract.

## Current MVP Position

The strongest implemented Bright Data path is:

1. Use saved Amazon Search raw JSON.
2. Import and normalize it.
3. Score opportunities.
4. Sync scored opportunities into AMI recommendation format.
5. Display them through the Recommendations UI.

Live Bright Data wrappers still exist in `lib/brightdata/client.ts`, but the production-quality path represented by the new scripts is currently offline/raw-file driven unless credentials and endpoints are configured.

## Commands Worth Keeping Handy

Install dependencies:

```bash
npm install
```

Run local app:

```bash
npm run dev
```

Typecheck:

```bash
npm run typecheck
```

Lint:

```bash
npm run lint
```

Import raw Bright Data search data:

```bash
npx tsx tools/import-brightdata-raw.ts --reset
```

Sync imported opportunities into app recommendations:

```bash
npx tsx tools/sync-brightdata-to-ami-result.ts --limit 20
```

## Known Gaps And Follow-Ups

- The two TypeScript tools are not yet exposed as `package.json` scripts.
- The raw import pipeline currently targets Amazon Search only.
- The sync script marks synced Bright Data evidence as `demo_fallback`, even though the source is preserved Bright Data output.
- Supplier and inventory validation are still simulated or pending in the Bright Data sync path.
- eBay, AliExpress, and TikTok data are documented as optional/future, not blockers for the MVP.
- `MONGODB_URI` is required for the scripts; the app itself still has an in-memory fallback for demo use.
- Raw pipeline models and app-facing models both use "opportunity" language but write to different data shapes; changes here need extra care.

## Recommended Next Step

Add npm scripts for the two tools and document the full import-to-sync flow in `README.md`, so a judge or teammate can reproduce the Bright Data-backed recommendation path without reading the tool source.
