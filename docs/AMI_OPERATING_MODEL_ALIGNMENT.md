# AMI Operating Model Alignment

This implementation follows `AMI_Agent_Operating_Model_Hackathon_Base.md` as the canonical operating model.

## Official 5-Agent Model

AMI exposes five agents:

- AMI Orchestrator: builds the goal-specific strategy, assigns intent, resolves conflicts, applies scoring, and produces the final recommendation.
- Inventory Assistant: maps internal marketplace context, inventory health, cannibalization, restock need, and operational fit.
- Trend Assistant: evaluates demand, market momentum, and social or marketplace trend direction.
- Competitor Assistant: evaluates saturation, pricing pressure, whitespace, availability gaps, and promotion intensity.
- Supplier Assistant: evaluates sourcing feasibility, availability, cost, delivery risk, supplier trust, and margin potential.

`Coordinator` and `Strategy` are no longer exposed as separate agents. Their former synthesis/verdict roles are mapped into AMI Orchestrator.

## Business Goal Workflows

- Discover New Products: Inventory -> Trend -> Competitor -> Supplier -> AMI Orchestrator.
- Stock Optimization: Inventory -> Competitor + Trend -> Supplier optional -> AMI Orchestrator.
- Revenue Stock Opportunities: Inventory -> Trend + Competitor -> Supplier or Inventory validation -> AMI Orchestrator.

Each assistant run stores a goal-specific `goalIntent`, `executionOrder`, `sourcesUsed`, `missingSignals`, `fallbackSignals`, and `confidenceAdjustment`.

## Backend Persistence Objects

The Mongo-backed app model now includes:

- `analysisRuns`
- `assistantRuns`
- `rawSourceSnapshots`
- `normalizedProducts`
- `inventorySnapshots`
- `trendSignals`
- `competitorSnapshots`
- `supplierCandidates`
- `productMatches`
- `evidencePackages`
- `recommendations`
- `assistantUsage`

The route response also includes `analysisRun`, `assistantRuns`, `recommendations`, `evidencePackages`, `rawSourceSummary`, and `dataQualitySummary`.

## Raw Source Classification

Bright Data and fallback attempts are classified before normalization:

- `success`: usable records with required fields.
- `partial`: records exist but critical fields are missing.
- `empty`: valid response with no product records.
- `failed`: scraper or request failed.

Failures and empty supplier responses do not convert demand, trend, or supplier availability to zero.

## Fallback Handling

Price, reviews, sales, availability, delivery, brand, and category use the fallback order from the official model. Missing values remain `null`, `unknown`, or an explicit missing signal. Fallbacks are listed in `dataQuality.fallbacksUsed` and reduce confidence.

TikTok, TikTok Shop, and Facebook source failures mark trend data as degraded and use marketplace demand proxies. Alibaba/AliExpress empty or failed responses mark supplier signals as unknown and shift direct action toward validation.

## Scoring

`lib/agents/formulas.ts` centralizes null-safe scoring helpers:

- `normalize`
- `inverseNormalize`
- `safeDiv`
- `weightedAvailableScore`
- `clamp`

Goal scores are calculated as available weighted scores:

- `discoverOpportunityScore`
- `stockActionScore`
- `stockProtectionScore`
- `revenueOpportunityScore`

Missing metrics are ignored and available weights are recalculated instead of becoming zero.

## Recommendation Contract

Recommendations include:

- `recommendedAction`
- `opportunityType`
- `finalScore`
- `confidence`
- `risk`
- `reasoningSummary`
- `metrics`
- `agentContributions`
- `dataQuality`
- `evidenceRefs`

Legacy UI fields remain present for compatibility while the canonical contract is consumed by the updated recommendations screen.

## Frontend Hierarchy

The recommendations screen follows:

1. Final recommendation.
2. Why it matters.
3. Confidence and risk.
4. Agent contribution summary.
5. Data quality and fallback notice.
6. Evidence panels.
7. Raw/source technical details.

The processing screen and assistant usage screen show all five official agents, goal intent, execution order, source usage, fallback signals, and missing-signal summaries where available.

## Live, Demo, and Fallback Modes

- Live run without fallback: `mode = live`, `sourceMode = live`.
- Live attempt with fallback: `mode = fallback`, `sourceMode = mixed`.
- No live source and demo data: `mode = demo`, `sourceMode = demo`.

Fallback usage is never hidden from the API response or UI.
