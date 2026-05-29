# Autonomous Marketplace Intelligence System / AMI

AMI is a decision-first marketplace intelligence MVP for operators, growth teams, founders, analysts, and hackathon judges. It coordinates live or demo-fallback web intelligence into a ranked business recommendation with confidence, risk, evidence, and assistant contribution.

## Short Description

AMI helps marketplace teams understand what opportunity was detected, why it matters, what action is recommended, what risk is attached, and where Bright Data contributes to the intelligence workflow.

## Long Description

Marketplace teams often compare competitor pricing, supplier context, demand signals, inventory posture, and product trends across disconnected tools. AMI turns those fragmented signals into an explainable recommendation workspace. The MVP keeps business action first, evidence available through progressive disclosure, and technical details last.

AMI is not a raw scraper UI, spreadsheet replacement, chatbot-first experience, full inventory system, automated purchasing tool, or production billing product.

## Problem Statement

Marketplace decisions are time-sensitive and often made from stale or incomplete information. Teams can miss demand shifts, overstock weak products, understock rising products, misread competitor pressure, or choose supplier opportunities without enough confidence.

## Solution Overview

AMI is the main advisor and coordinator. It receives the market context, requests live product/web data through Bright Data first, normalizes compact evidence, coordinates a data-driven agent list, and returns a prioritized business verdict.

- Trend Assistant: detects demand signals, social momentum, seasonality, and product trend direction.
- Competitor Assistant: tracks competitor pricing, promotions, availability, and market pressure.
- Supplier Assistant: evaluates sourcing feasibility, unit cost, delivery windows, and supplier risk.
- Inventory Assistant: evaluates inventory posture, stock risk, margin context, and operational opportunity.
- Coordinator Agent: compares specialist outputs, detects agreements/conflicts, and identifies confidence gaps.
- Strategy Agent: produces the final AMI verdict, recommended action, next step, and external action payload.

The integration-ready analysis pipeline is:

```txt
User Briefing
-> Bright Data live collection
-> Safe evidence references
-> Normalization + KPI extraction
-> Immediate graph data
-> AI agent analysis
-> Cross-agent synthesis
-> Final AMI verdict
-> Portable action payload
```

## Six Macro Screen Architecture

1. Start / Access Screen: AMI intro, overview access, demo access, login, and registration.
2. Market Context Setup Screen: product/category, target marketplace, supplier source, business goal, region/currency, and optional inventory-context use.
3. Processing Screen: AMI status, progress, dynamic agent activity states, immediate graph metrics, source collection status, and only back-to-setup action.
4. AMI Recommendations Screen: final verdict, opportunity ranking, agent contribution summary, synthesis, comparison, evidence drawer, and save/approve/export actions.
5. Assistant Overview Screen: assistant usage, credit limits, 90% alert, exceeded-limit warning, last run, latest contribution, sources, usage count, and estimated usage cost.
6. Account / Workspace Screen: user profile, marketplace profile, saved reports, historical recommendations, inventory context, sync status, approved recommendation history, demo payment simulator, and credit management.

## Bright Data Requirement

The code includes Bright Data provider adapters for:

- SERP API
- Web Scraper API
- Web Unlocker

Bright Data is always attempted before fallback when `AMI_USE_LIVE_WEB=true`. AMI prefers a configured structured dataset, then Web Unlocker, then SERP. Results are capped to a maximum of 5 products per analysis. Raw HTML and full scraped pages are not sent to the LLM; only normalized product JSON, KPIs, and safe evidence summaries are used downstream.

If Bright Data fails and `AMI_ALLOW_DEMO_FALLBACK=true`, AMI uses deterministic Bright Data-shaped fallback data and marks the run as fallback.

## AIMLAPI Requirement

AIMLAPI is used only for compact JSON analysis. Specialist agents run deterministic local analysis first; the Coordinator and Strategy/Verdict agents call AIMLAPI when configured. If AIMLAPI is disabled, missing, or returns invalid JSON, AMI falls back to deterministic synthesis and still returns a usable final report.

## Tech Stack Detected From Repo

- Next.js App Router
- TypeScript
- React
- TailwindCSS
- MongoDB with Mongoose
- Zod validation
- Lucide React icons
- Optional OpenAI SDK dependency from the detected stack; AIMLAPI is the active LLM provider for synthesis/verdict when configured
- bcrypt password hashing
- Node crypto AES-256-GCM for inventory credential encryption

## Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

On Windows PowerShell systems with script execution disabled:

```bash
npm.cmd install
npm.cmd run dev
```

## Environment Variables

Create `.env.local` from `.env.example`.

```bash
MONGODB_URI=

AIMLAPI_API_KEY=
AIMLAPI_BASE_URL=https://api.aimlapi.com/v1
AIMLAPI_MODEL=google/gemini-2.5-flash
AIMLAPI_AGENT_MODEL=google/gemini-2.5-flash-lite-preview
AIMLAPI_VERDICT_MODEL=google/gemini-2.5-flash
AIMLAPI_ENABLED=true
AIMLAPI_TIMEOUT_MS=30000

BRIGHT_DATA_API_KEY=
BRIGHT_DATA_MODE=api
BRIGHT_DATA_ZONE=ami_marketplace_unlocker
BRIGHT_DATA_WEB_UNLOCKER_ZONE=ami_marketplace_unlocker
BRIGHT_DATA_SERP_ZONE=ami_marketplace_unlocker
BRIGHT_DATA_WEB_UNLOCKER_ENDPOINT=https://api.brightdata.com/request
BRIGHT_DATA_SERP_ENDPOINT=https://api.brightdata.com/request
BRIGHT_DATA_WEB_SCRAPER_ENDPOINT=https://api.brightdata.com/datasets/v3/scrape
BRIGHT_DATA_TIMEOUT_MS=30000
BRIGHT_DATA_MAX_REQUESTS_PER_ANALYSIS=5
AMI_USE_LIVE_WEB=true
AMI_ALLOW_DEMO_FALLBACK=true
AMI_MAX_DISCOVERY_RESULTS=5

AMI_SESSION_SECRET=
AMI_CREDENTIAL_SECRET=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Without MongoDB, AMI uses an in-memory demo fallback for local judging. Without Bright Data or AIMLAPI credentials, AMI uses clearly labeled deterministic fallback paths.

## Live Analysis And Smoke Tests

Run the app:

```bash
npm.cmd run dev
```

Run safe smoke tests. They print only yes/no status, model names, provider status, and safe errors. They do not print secrets.

```bash
npm.cmd run test:env
npm.cmd run test:aimlapi
npm.cmd run test:brightdata
npm.cmd run test:analysis
npm.cmd run test:fallback
```

Cost-control limits:

- Maximum 5 products/results per analysis.
- Maximum 10 evidence snippets sent to AIMLAPI.
- No raw HTML, full scraper payloads, image data, embeddings, audio, video, OCR, or external action execution in this task.

## Inventory Context MVP

Inventory context is a lightweight source layer for AMI recommendations, not a full inventory management system. It supports:

- `marketplace_url`
- `api_key`
- `bearer_token`
- `csv_upload`
- `json_upload`
- `demo_snapshot`

The Control Hub / Marketplace Setup inventory card lets users connect, re-sync, or remove the current inventory source. The selected connection type controls the visible fields immediately:

- Marketplace URL mode shows marketplace name and URL.
- API key mode shows marketplace name, URL, and a masked secure credential input.
- Bearer token mode shows marketplace name, URL, and a masked secure credential input.
- CSV upload mode shows a `.csv,text/csv` file input and selected file metadata.
- JSON upload mode shows a `.json,application/json` file input, selected file metadata, and JSON parse validation.
- Demo snapshot mode uses seeded AMI inventory data for local testing.

Saved inventory status includes connection type, credential type, source summary, latest sync timestamp, uploaded file metadata, and warning/error state. Raw API keys, bearer tokens, and uploaded file contents are not shown back in the UI.

## Inventory-Aware Analysis Rules

Inventory context must not block every analysis goal.

- `discover_new_products`: inventory is optional. If `useInventoryContext` is true but no usable inventory source is connected, AMI continues with trend, competitor, and supplier signals. The Inventory Assistant is marked as warning/skipped and the final strategy includes an inventory warning.
- `stock_optimization`: inventory is required. Missing inventory returns a clear validation error instead of leaving the run pending.
- `revenue_stock_opportunities`: inventory is required. Missing inventory returns a clear validation error instead of leaving the run pending.

Demo fallback never fails only because inventory is missing. When no usable inventory source is available, AMI skips inventory context, returns a complete strategy result, and includes a warning.

## Demo Flow For Judges

1. Start at `/` and choose Demo.
2. Confirm or edit the Market Context Setup values.
3. Start AMI Analysis.
4. Watch the Processing screen show immediate graph metrics, source status, and dynamic agent status.
5. Review AMI Recommendations: final verdict, recommended next action, opportunity score, estimated margin, demand signal, risk, confidence, agreements/conflicts, evidence summary, and portable action payload.
6. Open Evidence and source data to see Bright Data live/demo contribution.
7. Save, approve, or export the recommendation.
8. Open Account / Workspace to review saved reports, approved history, inventory context, demo credits, and sync status.
9. Open Assistant Overview to review usage, limits, 90% alerts, and exceeded-limit warnings.

## Submission Checklist

- Project Title: Autonomous Marketplace Intelligence System / AMI
- Short Description: included above
- Long Description: included above
- Technology & Category Tags: Next.js, TypeScript, MongoDB, Zod, Bright Data, Marketplace Intelligence, GTM Intelligence, AI Agents
- Cover Image: placeholder to be added for submission
- Video Presentation: placeholder to be added for submission
- Slide Presentation: placeholder to be added for submission
- Public GitHub Repository: repository URL to be added for submission
- Demo Application Platform: deployment platform to be added for submission
- Application URL: deployment URL to be added for submission

## Security Notes

- Passwords are stored only as `passwordHash` using bcrypt.
- Sessions use httpOnly cookies and store hashed session tokens.
- Workspace isolation is enforced by resolving API requests through the active session workspace.
- Inventory credentials are encrypted with AES-256-GCM.
- Inventory API responses expose only `credentialFingerprint` and `maskedCredential`.
- Inventory URLs are limited to http/https and block localhost/internal network targets.
- CSV/JSON inventory uploads stay inside the existing MVP persistence path and expose only file metadata in UI/API status responses.
- Demo fallback and optional-inventory analysis paths do not log or expose raw credentials or uploaded file contents.
- Demo payment never stores full card number or CCV.
- Demo payment stores only card last four, expiration month/year, `simulated_approved`, and credit amount.
- Zod validates auth, market context, assistant output, recommendation, evidence, inventory, usage limit, and demo payment payloads.
- Audit events are recorded for inventory connections, simulated credit purchases, and assistant credit limit changes.

## Out Of Scope

- Real Stripe checkout, subscriptions, taxes, invoices, or billing portal
- Production payment processing
- Full inventory management
- Automated purchasing
- Standalone reports, history, evidence, inventory, billing, or raw-data explorer macro screens
- Real external action execution from the generated payload
- Assistant customization or enterprise permission controls
- Chatbot-first UX

## Known Limitations

- Live Bright Data calls require credentials and endpoint configuration.
- Bright Data endpoint permissions and dataset response shapes can vary by account; safe fallback is used when the response cannot be normalized.
- AIMLAPI must return valid JSON matching the Zod schemas; deterministic fallback is used otherwise.
- Demo fallback snapshots are deterministic and labeled as demo.
- MongoDB persistence is optional for local demo; in-memory state resets when the dev server restarts.
- Inventory CSV/JSON uploads are temporary MVP source context, not full dataset ingestion or inventory table management.
- External action payloads are generated for integration readiness only and do not call external systems.

## Roadmap

### Post-hackathon: Improving Bright Data scraper quality

For the hackathon MVP, the Bright Data section focuses on “making it work” — ensuring the minimum evidence needed for a usable report is available.

In the future, we plan to extend the current BrightData scraper library. The scrapers shipped today are the **default scrapers from the library**.

The next step is to develop more **marketplace/product-specific** scrapers with higher extraction quality and more consistent report outputs (reducing empty results, timeouts, and formatting variability), while keeping the same normalization and traceability flow.


