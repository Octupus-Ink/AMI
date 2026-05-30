# AMI UI Audit Report for Claude

## 1. Executive Summary

The current AMI UI is mostly implemented and follows the intended structure in broad strokes. The repository already includes:
- a public entry/access screen with login, register, and demo access
- a briefing screen for market context and business goals
- an orchestration/processing state where assistants are coordinated
- a main recommendations workspace with ranked opportunities, evidence, and export actions
- an assistants usage screen with credit controls
- a control hub workspace with user, inventory, and workspace status

However, the UI has gaps and inconsistencies:
- the home entry screen has anchor links (`#how-it-works`, `#pricing`) that do not appear to target actual page sections
- there is no dedicated pricing content or clear product overview section beyond the login/demo entry
- the recommendations workspace is rich but still has a generic multi-tab dashboard feel and may over-emphasize candidate selection rather than a single advisor-led decision path
- `AccountWorkspaceClient` exposes a lot of inventory setup details that can feel closer to a platform settings panel than a lightweight control hub
- the assistant model is partly conflated with an internal `AMI Orchestrator` role, which may blur the desired visible assistant count

Overall, the UI leans toward an enterprise SaaS adviser, but it still contains generic dashboard patterns and some prototype-like behaviors. The strongest advisor signal is in copy and the AMI Strategy / evidence pages, while weaker signals are seen in home access and Control Hub complexity.

Top 5 priority UI issues:
1. Missing or broken homepage anchor sections for `How it works` and `Pricing`.
2. Recommendations screen lacks a resilient loading/error state when analysis data is unavailable.
3. Control Hub inventory form is too detailed for MVP and risks looking like full inventory management.
4. The processing screen mixes assistant orchestration with preliminary metrics, which can dilute the temporary state.
5. Home access uses a login/register toggle with long registration form, reducing the polished entry experience.

## 2. Route and Screen Inventory

| Route / File | Current Screen Name | Intended Screen Match | Status | Notes |
|---|---|---|---|---|
| `/app/page.tsx` | `StartAccessClient` | Home / Access | Partially aligned | Public entry exists with login/demo/register, but missing actual pricing/overview sections and anchor targets. |
| `/app/market-context-setup/page.tsx` | `MarketContextClient` | Briefing | Correct | Captures product, category, marketplace, supplier source, goal, region, currency, inventory status. |
| `/app/processing/page.tsx` | `ProcessingClient` | Orchestration State | Correct | Shows assistant coordination state, progress, and redirect to recommendations. |
| `/app/recommendations/page.tsx` | `RecommendationsClient` | AMI Strategy | Correct | Includes executive recommendation, signals, evidence panels, candidate tabs, and export placeholder. |
| `/app/assistant-overview/page.tsx` | `AssistantOverviewClient` | Assistants | Correct | Provides assistant usage, credit limits, alerts, latest contribution, and update actions. |
| `/app/account-workspace/page.tsx` | `AccountWorkspaceClient` | Control Hub | Correct | Includes user profile, linked services, Bright Data status, demo credits, marketplace profile, inventory context, and recommendation history. |

Extra or non-MVP screens:
- No obvious extra top-level route outside the intended flow.
- The homepage navigation suggests pricing and how-it-works sections that are not implemented.

## 3. Navigation Audit

- Public navigation is contained in `components/layout/AppShell.tsx` via `HomeTopNav` when `pathname === '/'`.
- Internal app navigation is also in `components/layout/AppShell.tsx` using `internalNavigation` with:
  - Briefing
  - AMI Strategy
  - Assistants
  - Control Hub
  - Log out
- This internal nav labels match the intended naming well.
- There are no visible old labels like Dashboard, Recommendations Dashboard, or Market Context in the active nav.
- Bright Data is exposed contextually via `BrightDataPill` in the home top nav, processing workspace, evidence sections, and likely other pages, which is appropriate.
- The public home nav includes anchor links for `How it works?` and `Pricing`, but the scanned `components/access/StartAccessClient.tsx` file does not define matching section anchors, indicating broken or missing navigation targets.

File references:
- `components/layout/AppShell.tsx` (nav labels, Bright Data placement)
- `components/access/StartAccessClient.tsx` (home entry content)

## 4. Home / Access Screen Audit

Source: `components/access/StartAccessClient.tsx`

Supports:
- AMI logo and product name
- clear description of AMI's advisory role
- demo access button (`Start Demo Analysis`)
- login access form
- new workspace / register flow via `#new-workspace` hash

Issues:
- The screen uses a login/register panel switch, which can feel like a prototype if the product entry is expected to be a single polished landing page.
- There is no visible pricing section or meaningful entry for the `Pricing` anchor.
- Anchor nav items such as `How it works?` and `Pricing` are present in `AppShell` but not backed by page anchors in `StartAccessClient`.
- The register form is lengthy and more onboarding/settings oriented than an immediate access experience.

Overall impression: functional but not fully polished. It reads more like a demo portal and workspace setup console than a finished product landing page.

## 5. Briefing Screen Audit

Source: `components/market-context/MarketContextClient.tsx`

Strengths:
- Captures key fields: product, category, target marketplace, supplier source, business goal, region, currency.
- Shows inventory status as either connected or not connected.
- Displays latest sync timestamp or demo snapshot status.
- Provides a `Connect inventory` / `Re-sync` button that leads to Control Hub.
- Does not expose manual assistant configuration.

Potential gaps:
- Inventory connection is shown as a status strip and button, but the briefing itself does not fully explain whether inventory is optional or required for the selected goal, aside from a warning for inventory-dependent goals.
- `useInventoryContext` is automatically derived from connection status, which is good, but the field is hidden from direct editing.

Conclusion: the briefing screen largely supports the intended decision context and keeps assistants implicit.

## 6. Orchestration / Processing State Audit

Source: `components/processing/ProcessingClient.tsx`

Strengths:
- Clearly presented as a temporary coordination state.
- Includes `Back to briefing` action only.
- Displays live progress and source mode.
- Shows cards for each assistant in `VisibleAssistants`.
- Each assistant card supports pending/running/completed/warning/failed states and latest activity text.
- Includes a Bright Data badge and source status details.

Notes:
- The screen shows preliminary metrics when available, which is useful but may slightly shift attention away from the temporary orchestration state.
- It appears to treat orchestration as a workspace step rather than a permanent screen, which aligns with the intended design.

## 7. AMI Strategy / Recommendations Workspace Audit

Source: `components/recommendations/RecommendationsClient.tsx`

Strengths:
- Central recommendation section is present with executive recommendation, score, risk, confidence, and business goal.
- Uses a clear hierarchy: top summary, primary metrics, quality notice, strategy signals, action tabs.
- Evidence is available in a dedicated `Evidence & Reasoning` tab.
- Includes product candidate, promo candidate, inventory action, and supplier comparison tabs.
- Provides an export action placeholder.

Concerns:
- The UI is more complex than a single recommendation workspace; the tabbed candidate selection and supplier coverage features can feel like a generic analytics dashboard.
- There is a large focus on candidate selection and tabbed evidence, which may reduce the sense of a singular advisory conclusion.
- Export is currently a placeholder and not a working action.

Overall: the recommendations workspace is robust and adviser-oriented, but it also carries a dashboard-like structure that may need simplification for clearer MVP messaging.

## 8. Evidence and Trust Audit

Evidence and trust elements found:
- `Evidence & Reasoning` tab with source evidence fields and Bright Data context.
- Assistant contribution summaries and contribution status badges.
- Data quality warnings shown when quality issues exist.
- `Source mode`, `analysis run`, `collection mode`, and `collected at` metadata are surfaced.
- `Bright Data product` and `Bright Data mode` appear in evidence details.

Missing / weak areas:
- Evidence is mostly on demand inside a details panel/tab rather than always visible in the primary recommendation view.
- There is some reliance on generic summary text and badges, which may feel black-box without direct source snippets.
- The interface does not clearly show raw source data provenance on the main recommendation card.

Conclusion: trust signals exist and are generally well placed, but evidence is not always immediately visible and may require deeper interaction to verify.

## 9. Assistant Model Audit

Source: `lib/schemas/ami.ts`, `components/processing/ProcessingClient.tsx`, `components/assistants/AssistantOverviewClient.tsx`

Findings:
- The UI is built around `VisibleAssistants`, which includes:
  - AMI Orchestrator
  - Inventory Assistant
  - Trend Assistant
  - Competitor Assistant
  - Supplier Assistant
- This means the UI effectively shows five roles, while the intended product model describes AMI as coordinator plus four visible assistants.
- The visible agents are consistently called assistants in most UX copy, but some code and copy still use `agent` or `agentStatus` internally.
- There are no outdated references to only three assistants in the inspected files.
- The assistants are presented as operational support roles rather than chatbots or mascots.

Risk: the presence of `AMI Orchestrator` as a visible role may confuse the intended count of four assistants.

## 10. Assistants Usage Screen Audit

Source: `components/assistants/AssistantOverviewClient.tsx`

MVP usage-control coverage:
- Usage visibility per assistant
- Credit limit editing per assistant
- Alert states: normal, near_limit, exceeded, paused
- Last run and latest contribution text
- Data sources used and estimated usage cost

Good fit for MVP: this screen is focused on assistant credit and health rather than deep analytics or permissions.

Potential UX issue:
- The screen title still describes monitoring `AMI agents`, which may be slightly inconsistent with the `Assistants` label.

## 11. Control Hub / Account Workspace Audit

Source: `components/workspace/AccountWorkspaceClient.tsx`

Control Hub coverage:
- User profile section
- Linked services section with Bright Data status and credential check
- Payment / mock payment section with demo explanation
- Demo credits section
- Marketplace profile section
- Inventory context section with sync status, connection mode, and upload options
- Saved reports section
- Approved recommendation history section

Observations:
- Bright Data visibility is present in linked services as `Bright Data status`.
- Inventory is implemented with marketplace URL, credential type, file upload, sync, and remove actions.
- The inventory section is more detailed than a simple status panel; it starts to look like an inventory configuration area.
- Approved recommendation history and saved reports are included, which aligns well with control hub goals.

Conclusion: Control Hub is mostly correct, but inventory setup should remain lighter for MVP.

## 12. Bright Data Visibility Audit

Locations where Bright Data is visible:
- Home public nav via `BrightDataPill` in `AppShell`
- Processing screen top section with `BrightDataPill`
- Recommendations evidence tab displays `Bright Data product` and `Bright Data mode`
- Control Hub linked services section shows `Bright Data status`

Assessment:
- Bright Data is visible enough for evaluation.
- It appears contextually rather than dominating global navigation.
- The homepage top nav presence is subtle and appropriate.

## 13. Visual Direction Audit

Strengths:
- Light enterprise SaaS aesthetic with neutral surfaces and teal accents.
- Amber/orange is used for warnings and fallback states.
- Red is reserved for error/failure states.
- Interfaces are clean, with a restrained use of cards and surfaces.
- No strong sci-fi or dark-mode aesthetic was detected.

Areas for cleanup:
- Some forms and control sections feel generic rather than advisor-focused.
- The main strategy screen is content-heavy and could benefit from simplified editorial hierarchy.
- `Partner’s Choice` and multi-panel selection areas increase visual complexity.

Overall visual direction is close to the desired light enterprise SaaS foundation.

## 14. Copy and Tone Audit

Positive tone:
- Copy is mostly clear, analytical, and professional.
- The product voice uses advisor-type phrases like `reviews marketplace context`, `coordinates specialized assistants`, and `ranked business recommendation`.
- Risk and confidence language is present in the recommendation screen.

Issues:
- Some copy is still generic or marketing-like, e.g. `Partner’s Choice` and `Monitor AMI agents`.
- The home page form is functional but not editorially polished as a product entry point.
- The `Assistants` screen headline uses `agents` internally.

Examples to revise later:
- `Monitor AMI agents, credit limits, source activity, and threshold states.`
- `Partner’s Choice: ... selected items | suppliers` (overly promotional tone)
- `Real payment processing is not active in this MVP.` (good transparency, but payment section may not belong in Core Control Hub MVP)

## 15. Data Visualization Audit

Current visualizations:
- Metric cards for progress and key metrics
- Score badges for recommendation metrics
- Simple token and bar-style credit usage indicators
- Comparison tables in the supplier tab

Assessment:
- The UI avoids overly complex charts, which is appropriate.
- It could improve by making the recommendation hierarchy more visually distinct from candidate tables.
- There are no complex or decorative charts distracting from decision-making.

## 16. Responsiveness and Mobile Audit

Responsive behavior observed:
- `AppShell` collapses navigation into a small menu on mobile.
- The processing page uses responsive wrapping for assistant cards.
- The briefing page fields wrap for smaller widths.
- Recommendation tabs and paginated candidate cards adapt to viewport width.

Potential issue:
- The homepage anchor nav is hidden on small screens, which is okay, but the anchor links are broken regardless.

No major mobile-breaking layouts were observed in the inspected code.

## 17. Accessibility Audit

Positive observations:
- Form fields use labels.
- Buttons and inputs have focus styling from Tailwind classes.
- Assistants usage actions include `aria-label` on save buttons.
- Summary and status text use semantic headings and paragraphs.

Issues to verify / improve:
- The `RecommendationsClient` returns `null` while loading analysis data, which may create a blank page without a visible loading state.
- `details` summary controls are used, but their contrast and state should be checked in rendering.
- The home page anchor links point to non-existent section IDs.

## 18. Implementation Risk Audit

Identified risks:
- Hardcoded assistant list in `lib/schemas/ami.ts` and `VisibleAssistants` may be brittle if assistant count changes.
- Demo and workspace defaults are hardcoded in `components/access/StartAccessClient.tsx` and `components/workspace/AccountWorkspaceClient.tsx`.
- The homepage anchor nav is misaligned with actual page content.
- `RecommendationsClient` depends on `localStorage` fallback and can render nothing if analysis is unavailable.
- Inventory setup in `AccountWorkspaceClient` exposes credential input and file upload flows that may be beyond lightweight MVP scope.
- Export action is a placeholder rather than a real product feature.
- Some backend dependencies are assumed available for `/api/analysis`, `/api/workspace`, `/api/inventory/*`, and `/api/assistant-usage`.

## 19. Priority Fix List

| Priority | Issue | Affected Area | Why It Matters | Suggested Direction |
|---|---|---|---|---|
| P0 | Missing homepage anchor targets for `How it works` and `Pricing` | Home / Access | Broken navigation undermines first impression and makes the entry page feel unfinished. | Remove orphan anchors or implement the target content sections on the home page. |
| P0 | Recommendations screen can render blank when analysis data is unavailable | AMI Strategy | Demo or live users may see an empty page instead of a loading/error state. | Add a visible loading/error state and recover path to briefing or processing. |
| P1 | Inventory section in Control Hub is too detailed for MVP | Control Hub | Makes control hub feel like an inventory management console rather than a lightweight workspace setting. | Simplify inventory controls to status, connect/re-sync actions, and a compact demo upload option. |
| P1 | Visible assistant list includes `AMI Orchestrator` as a separate card | Processing / Assistant model | Confuses the advertised four visible assistant model and dilutes the advisor/assistant distinction. | Treat orchestrator as a coordinator status item, not a visible assistant card. |
| P1 | Home access uses login/register panel switch and lengthy registration copy | Home / Access | Weakens product entry polish and makes initial onboarding feel like a prototype. | Simplify the entry page with clearer demo-first and access-first paths, and reduce form overload. |
| P2 | Evidence is hidden in a tab and not surfaced on the main recommendation card | AMI Strategy | Trust signals may feel optional or hidden rather than integral to the recommendation. | Surface a compact evidence summary inline with the executive recommendation. |
| P2 | `Partner’s Choice` multi-selection UI adds dashboard complexity | AMI Strategy | May distract from the core recommendation and business advisor story. | Simplify or rename to a more direct recommendation review flow. |
| P2 | `Bright Data` is visible but not tied to a clear data sourcing explanation | Bright Data visibility | Reviewers may see the badge but not understand exactly what it powers. | Add a concise note in evidence or processing state explaining Bright Data's role. |

## Questions for Claude

1. Does this route structure match the expected AMI product architecture for a hackathon MVP?
2. Does the current UI feel more like a marketplace intelligence advisor or a generic analytics dashboard?
3. Is the briefing flow sufficiently complete for decision context, or should marketplace/goal fields be simplified?
4. Does the processing screen correctly read as a temporary assistant orchestration state?
5. Is the recommendations workspace too complex for MVP, or is the tabbed candidate layout acceptable?
6. Does evidence and trust appear adequately supported, or should more raw source provenance be surfaced upfront?
7. Does the Control Hub feel credible for a demo without becoming a full inventory management console?
8. Is the visible Bright Data placement appropriate, or does it need stronger contextual explanation?
9. Should the homepage entry avoid the login/register panel switch and instead favor a simpler demo-first landing?
10. Does the assistant model need to explicitly separate AMI orchestration from the four visible assistants?
11. Are the current copy and tone aligned with an advisor persona rather than an AI chatbot persona?
12. Would the current UI be credible for a hackathon evaluation, or does it need a sharper advisor-first hierarchy?

## Files inspected

- `app/page.tsx`
- `app/market-context-setup/page.tsx`
- `app/processing/page.tsx`
- `app/recommendations/page.tsx`
- `app/assistant-overview/page.tsx`
- `app/account-workspace/page.tsx`
- `components/layout/AppShell.tsx`
- `components/layout/PagePrimitives.tsx`
- `components/access/StartAccessClient.tsx`
- `components/market-context/MarketContextClient.tsx`
- `components/processing/ProcessingClient.tsx`
- `components/recommendations/RecommendationsClient.tsx`
- `components/assistants/AssistantOverviewClient.tsx`
- `components/workspace/AccountWorkspaceClient.tsx`
- `components/ui/BrightDataPill.tsx`
- `lib/schemas/ami.ts`

## Screens/routes inspected

- Home / Access (`/`)
- Briefing / Market Context Setup (`/market-context-setup`)
- Processing / Orchestration (`/processing`)
- AMI Strategy / Recommendations (`/recommendations`)
- Assistants (`/assistant-overview`)
- Control Hub / Account Workspace (`/account-workspace`)

## Components inspected

- `StartAccessClient`
- `MarketContextClient`
- `ProcessingClient`
- `RecommendationsClient`
- `AssistantOverviewClient`
- `AccountWorkspaceClient`
- `AppShell`
- `BrightDataPill`

## Assumptions made

- API endpoints such as `/api/analysis/start`, `/api/analysis/[id]`, `/api/workspace`, `/api/inventory/*`, and `/api/assistant-usage` are expected to exist and provide the required data.
- UI behavior is interpreted from component code rather than a running application.
- The homepage anchor links in `AppShell` were intended to navigate sections on the same page.
- `BrightDataPill` indicates intentional Bright Data visibility.

## Areas that could not be verified

- exact visual rendering and final responsive breakpoints in the browser
- live data behavior of APIs, demo fallback paths, and actual analysis result content
- whether the homepage is intended to include `How it works` and `Pricing` sections elsewhere in the workspace
- any UI in `app/api` or backend-only routes that are not directly visible in the inspected component tree
