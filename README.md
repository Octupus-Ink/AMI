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

AMI is the main advisor and coordinator. It receives the market context, coordinates five visible operational assistants, resolves the signals, and returns a prioritized recommendation.

- Trend Assistant: detects demand signals, social momentum, seasonality, and product trend direction.
- Competitor Assistant: tracks competitor pricing, promotions, availability, and market pressure.
- Supplier Assistant: evaluates sourcing feasibility, unit cost, delivery windows, and supplier risk.
- Inventory Assistant: evaluates inventory posture, stock risk, margin context, and operational opportunity.
- Risk Assistant: reviews confidence, risk exposure, evidence gaps, and readiness for the recommended action.

## Six Macro Screen Architecture

1. Start / Access Screen: AMI intro, overview access, demo access, login, and registration.
2. Market Context Setup Screen: product/category, target marketplace, supplier source, business goal, region/currency, and optional inventory-context use.
3. Processing Screen: AMI status, progress, five assistant activity states, source collection status, and only back-to-setup action.
4. AMI Recommendations Screen: executive recommendation, opportunity ranking, assistant contribution summary, comparison, evidence drawer, and save/approve/export actions.
5. Assistant Overview Screen: assistant usage, credit limits, 90% alert, exceeded-limit warning, last run, latest contribution, sources, usage count, and estimated usage cost.
6. Account / Workspace Screen: user profile, marketplace profile, saved reports, historical recommendations, inventory context, sync status, approved recommendation history, demo payment simulator, and credit management.

## Bright Data Requirement

The code includes Bright Data wrappers for:

- SERP API
- Web Scraper API
- Web Unlocker

The UI clearly labels Bright Data contribution in processing and recommendations. If `BRIGHT_DATA_API_KEY` and the relevant endpoint variables are configured, the wrappers can call live Bright Data endpoints. If they are not configured, AMI uses seeded Bright Data-shaped source snapshots and labels the result as demo fallback. The MVP does not claim live scraping is active unless credentials and endpoints are present.

## Tech Stack Detected From Repo

- Next.js App Router
- TypeScript
- React
- TailwindCSS
- MongoDB with Mongoose
- Zod validation
- Lucide React icons
- Optional OpenAI SDK dependency from the detected stack; not active in MVP recommendation generation
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
OPENAI_API_KEY=
BRIGHT_DATA_API_KEY=
BRIGHT_DATA_SERP_ENDPOINT=
BRIGHT_DATA_WEB_SCRAPER_ENDPOINT=
BRIGHT_DATA_WEB_UNLOCKER_ENDPOINT=
AMI_SESSION_SECRET=
AMI_CREDENTIAL_SECRET=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Without MongoDB, AMI uses an in-memory demo fallback for local judging. Without Bright Data credentials, AMI uses clearly labeled demo fallback snapshots.

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
4. Watch the Processing screen show AMI coordinating Trend, Competitor, Supplier, and Inventory assistants.
5. Review AMI Recommendations: action, opportunity score, estimated margin, demand signal, risk, confidence, reason, and next step.
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
- More visible assistants beyond Trend, Competitor, Supplier, and Inventory
- Assistant customization or enterprise permission controls
- Chatbot-first UX

## Known Limitations

- Live Bright Data calls require credentials and endpoint configuration.
- Demo fallback snapshots are deterministic and labeled as demo.
- MongoDB persistence is optional for local demo; in-memory state resets when the dev server restarts.
- Inventory CSV/JSON uploads are temporary MVP source context, not full dataset ingestion or inventory table management.
- OpenAI orchestration is not claimed as active production intelligence in this MVP.
