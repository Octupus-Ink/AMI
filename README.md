# Autonomous Marketplace Intelligence System

Hackathon MVP for a monolithic, deployable multi-agent marketplace intelligence product built with Next.js App Router.

## Problem Statement

Marketplace operators make pricing, inventory, and promotion decisions from fragmented signals: competitor prices, stockouts, product velocity, margin, and market demand. The MVP shows how specialized AI-ready agents can turn those signals into coordinated business recommendations.

## Solution Overview

The app runs three specialized agents and a coordinator:

- Competitor Intelligence Agent: detects competitor pricing, discount, stock, and delivery pressure.
- Inventory Optimization Agent: evaluates stock posture, sales velocity, margin, and inventory risk.
- Trend Intelligence Agent: evaluates demand direction, seasonality, and product trend strength.
- Coordinator Agent: combines all outputs into health score, recommendations, next actions, and risks.

All agents return structured JSON validated with Zod. The current MVP uses deterministic rule-based logic and demo data so judges can run it without external services.

## Architecture

- Single Next.js app using App Router.
- Frontend and backend live in the same project.
- API routes live under `app/api`.
- MongoDB is used as the shared intelligence layer when `MONGODB_URI` is configured.
- Demo fallback keeps the product functional without MongoDB, Bright Data, or OpenAI.
- No Express server, no separate worker service, no Redux.

## Bright Data Integration

`lib/brightdata/client.ts` provides prepared wrappers for:

- `searchSERP(query)`
- `scrapeProductPage(url)`
- `unlockUrl(url)`

If Bright Data credentials or endpoints are missing, each wrapper returns demo fallback data with `source: "demo-fallback"`. The Competitor and Trend agents reference this wrapper today.

This MVP does not claim real scraping is active unless Bright Data credentials and endpoints are configured.

## Tech Stack

- Next.js App Router
- TypeScript
- TailwindCSS
- MongoDB with Mongoose
- Zod
- Optional OpenAI SDK wrapper
- Lucide React icons

## Local Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

On Windows PowerShell systems with script execution disabled, use:

```bash
npm.cmd install
npm.cmd run dev
```

## Environment Variables

Create `.env.local` from `.env.example`:

```bash
MONGODB_URI=
OPENAI_API_KEY=
BRIGHT_DATA_API_KEY=
BRIGHT_DATA_SERP_ENDPOINT=
BRIGHT_DATA_WEB_UNLOCKER_ENDPOINT=
NEXT_PUBLIC_APP_URL=
```

## Demo Mode

The app remains functional when environment variables are missing:

- MongoDB missing: analysis runs are stored in an in-memory demo store and cached in browser local storage for the current session.
- Bright Data missing: competitor and trend agents use deterministic demo marketplace data.
- OpenAI missing: the prepared OpenAI wrapper returns demo text and agents use rule-based logic.

## API Routes

- `GET /api/health`: app, database, and integration status.
- `GET /api/demo`: demo project data and recent runs.
- `POST /api/analysis/start`: runs the three agents and coordinator.
- `GET /api/analysis/[id]`: returns a stored or fallback analysis result.
- `GET|POST /api/agents/competitor`: runs the Competitor Intelligence Agent.
- `GET|POST /api/agents/inventory`: runs the Inventory Optimization Agent.
- `GET|POST /api/agents/trend`: runs the Trend Intelligence Agent.

## Agent Contracts

Contracts are defined in `lib/schemas/agents.ts` and documented in `docs/agent-contracts.md`.

Each specialist returns:

- `agent`
- `status`
- `findings`
- `summary`
- `confidence`

The coordinator returns:

- `marketplaceHealthScore`
- `executiveSummary`
- `recommendations`
- `nextBestActions`
- `risks`

## Vercel Deployment

1. Push this repository to GitHub.
2. Import it into Vercel.
3. Add environment variables in the Vercel project settings.
4. Deploy.

The app will still deploy and run in demo mode without credentials, but persistent history requires MongoDB.

## Future Roadmap

- Replace deterministic agent rules with hybrid OpenAI structured output calls.
- Add authenticated project ownership.
- Add Bright Data Web Scraper dataset integrations.
- Add scheduled monitoring runs.
- Add alerting for competitor stockouts and price drops.
- Add exportable reports for marketplace operators.
