# AMI UI Reconstruction Audit V2

## Purpose
This audit documents the current UI structure of the AMI repository after the latest review. It is an audit-only report: no code or behavior changes were made. The report is based on static inspection of route wrappers and client components in `app/` and `components/`.

## Route and Shell Architecture

- `app/page.tsx` -> `StartAccessPage`
  - wraps `StartAccessClient` inside `AppShell`
- `app/market-context-setup/page.tsx` -> `MarketContextSetupPage`
  - wraps `MarketContextClient` inside `AppShell`
- `app/processing/page.tsx` -> `ProcessingPage`
  - wraps `ProcessingClient` inside `AppShell`
- `app/recommendations/page.tsx` -> `RecommendationsPage`
  - wraps `RecommendationsClient` inside `AppShell`
- `app/assistant-overview/page.tsx` -> `AssistantOverviewPage`
  - wraps `AssistantOverviewClient` inside `AppShell`
- `app/account-workspace/page.tsx` -> `AccountWorkspacePage`
  - wraps `AccountWorkspaceClient` inside `AppShell`

The `AppShell` component is the shared frame for all routes. It renders:
- a public home top nav for `/`
- a persistent internal navigation header for authenticated/workspace routes
- a logout action that clears local storage and redirects to `/`

## Main UI Flows

### Public home / access flow
- `StartAccessClient` is the home page entry point.
- It provides two primary flows:
  - demo analysis launch via `POST /api/auth/demo`
  - workspace access via login or registration forms
- The public form toggles between `login` and `register` using `window.location.hash` and supports `#new-workspace`.

### Briefing flow
- `MarketContextClient` is the briefing page.
- It loads saved briefing context from `localStorage` and workspace inventory state from `/api/workspace`.
- It exposes business context fields including product, category, marketplace, supplier source, business goal, region, and currency.
- It conditionally enables inventory-dependent behavior for goals like `stock_optimization` and `revenue_stock_opportunities`.
- On submit, it stores briefing state in localStorage and posts to `/api/market-context`, then routes to `/processing`.

### Processing / orchestration flow
- `ProcessingClient` manages analysis orchestration and polling.
- It validates `ami.marketContext` from localStorage and redirects to `/market-context-setup` when missing or invalid.
- It starts analysis at `/api/analysis/start`, then polls `/api/analysis/{runId}` until terminal state.
- It shows assistant state for `orchestrator`, `inventory`, `trend`, `competitor`, and `supplier`.
- On completion, it writes `ami.latestAnalysis` to localStorage and redirects to `/recommendations?runId={runId}`.

### Recommendations / strategy flow
- `RecommendationsClient` is the main strategy workspace.
- It loads analysis from the URL `runId` or localStorage fallback.
- If no analysis is available, it redirects back to `/market-context-setup`.
- It renders:
  - a strategy header with business goal and analysis metadata
  - a signal summary section with assistant findings
  - a tabbed workspace for Product Candidates, Promo Candidates, Inventory Actions, Supplier Comparison, and Evidence & Reasoning
  - Partner’s Choice selection and export placeholder state
- It contains drawer-based detail panels for selected items and supplier details.

### Assistants overview flow
- `AssistantOverviewClient` displays assistant usage and credit status.
- It fetches `/api/assistant-usage` and maps against the `VisibleAssistants` list.
- It supports editing credit limits with `PATCH /api/assistant-usage`.

### Control hub flow
- `AccountWorkspaceClient` is the workspace control hub.
- It loads `/api/workspace` snapshot and renders:
  - personal information
  - linked Bright Data service status
  - mock payment method details
  - demo credit balance and usage
  - marketplace profile and inventory context
  - saved report placeholders
  - approved recommendation history
- It supports inventory connection and sync flows with `POST /api/inventory/connect`, `POST /api/inventory/sync`, and `DELETE /api/inventory/connect`.

## Component-level Observations

### `AppShell`
- Provides shared internal nav and logout.
- The public home nav contains anchors to `#how-it-works`, `#pricing`, and `#new-workspace`.
- There is no matching `#how-it-works` or `#pricing` section in `StartAccessClient`; this suggests orphaned top-nav anchors on the home page.
- Internal route links are consistent with the primary workspace screens.

### `StartAccessClient`
- Supports both a login experience and a registration form in the same panel.
- Demo access is the fastest path and stores `ami.marketContext` and `ami.briefingContext` locally.
- Registration fields are extensive and include user/workspace/marketplace profile fields.

### `MarketContextClient`
- Uses localStorage to restore briefing context.
- Uses `MarketContextPayloadSchema` validation and `BusinessGoals` to validate business goal values.
- Inventory status is fetched independently and displayed with connect/re-sync controls.
- There is a user-facing warning when selecting inventory-dependent goals without connected inventory.

### `ProcessingClient`
- Includes detailed orchestration status, timing, and assistant states.
- Defines progress animation based on analysis lifecycle.
- Handles duplicate analysis attempts using sessionStorage lock keys.
- Sets `ami.latestAnalysis` and redirects after minimum visible delay.
- If analysis start or polling fails, it updates UI state and shows a message.

### `RecommendationsClient`
- Uses a selected recommendation state derived from analysis opportunities.
- Supports product, promo, inventory, and supplier selection.
- Uses drawers for details but has no visible fallback content if analysis is `null` or `selected` is missing: the entire component returns `null`.
- Evidence and reasoning panels are extensive and include source URL handling, risk input summaries, and Bright Data metadata.
- Some internal rendering is commented out, indicating prior alternative layouts or feature experiments.

### `AssistantOverviewClient`
- Designed as a monitoring page for assistant credit and usage.
- Builds a usage table from fetched API data, with default placeholders if data is missing.
- Contains a per-assistant credit limit form and alert copy.

### `AccountWorkspaceClient`
- Is a detailed control hub with workspace and inventory settings.
- Offers multiple inventory connection modes: marketplace URL, API key, bearer token, CSV upload, JSON upload, demo snapshot.
- Includes mock payment UI and credit reporting; payment processing is explicitly described as future-ready mock behavior.
- Contains direct controls for connect, resync, and remove inventory.
- The workspace summary and saved report/history sections appear to be demo scaffolding.

## Key Audit Findings

- The current UI is organized as a linear AMI workflow:
  1. Access / login / demo entry
  2. Market context briefing
  3. Processing / orchestration
  4. Recommendations strategy
  5. Assistant and workspace control views
- Routes are correctly wrapped by `AppShell`, maintaining a shared layout and navigation.
- `RecommendationsClient` has a silent null render path when analysis data is unavailable, which can produce a blank route screen.
- The home header contains anchor links that do not appear to resolve to visible page sections in the current `StartAccessClient` content.
- `AccountWorkspaceClient` currently presents a broad set of workspace controls and inventory UI, which may be more feature-rich than a minimal MVP needs.
- No code changes were introduced during this audit.

## Recommended follow-up checks

- Validate whether the root page should include the `#how-it-works` and `#pricing` target sections or whether the home nav should be simplified.
- Confirm whether `RecommendationsClient` should render a loading/empty state instead of returning `null` when analysis context is missing.
- Review the `AccountWorkspaceClient` control surface to ensure that the inventory connection panel matches actual backend support.
- Verify that the `demo` and `fallback` source modes in `ProcessingClient` align with expected demo provider behavior.
