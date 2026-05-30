# AMI UI Reconstruction Audit for Claude

## 1. Executive Summary

The AMI UI is implemented as a Next.js app with an `app/` router and a shared `AppShell` layout. It includes a public entry screen, a briefing screen, a processing/orchestration screen, a main recommendations workspace, an assistants usage page, and a control hub page.

Visually, the UI is a light enterprise SaaS style with neutral surfaces, teal accents, subtle shadowing, rounded cards, and small badge components. It mostly uses a calm, professional presentation rather than a glossy AI aesthetic.

Navigation is split into two modes: public home navigation on `/`, and internal app navigation on all routes after entry. The internal nav maps directly to Briefing, AMI Strategy, Assistants, and Control Hub.

Main screens found:
- Home / Access (`app/page.tsx` / `components/access/StartAccessClient.tsx`)
- Briefing (`app/market-context-setup/page.tsx` / `components/market-context/MarketContextClient.tsx`)
- Orchestration State (`app/processing/page.tsx` / `components/processing/ProcessingClient.tsx`)
- AMI Strategy (`app/recommendations/page.tsx` / `components/recommendations/RecommendationsClient.tsx`)
- Assistants (`app/assistant-overview/page.tsx` / `components/assistants/AssistantOverviewClient.tsx`)
- Control Hub (`app/account-workspace/page.tsx` / `components/workspace/AccountWorkspaceClient.tsx`)

The UI is closer to an advisor than a generic analytics dashboard in copy and page intentions, but its recommendations workspace and control hub still feel dashboard-like due to tabs, multiple candidate cards, and detailed inventory configuration.

Top 5 UI concerns for Claude:
1. The homepage includes `How it works?` and `Pricing` nav items, but the current code does not render those target sections.
2. The strategy page relies on cached analysis data and can render nothing if analysis is unavailable, creating a potential blank page experience.
3. Control Hub inventory setup is too detailed for MVP and risks feeling like a full inventory management tool.
4. The assistant model includes `AMI Orchestrator` as a visible role, which may conflict with the intended four visible assistants.
5. Evidence and trust are mostly contained in details/tabs rather than surfaced in the main recommendation hierarchy.

## 2. Repository UI Structure

| Area | Files / Folders | Purpose | Notes |
|---|---|---|---|
| Routing | `app/page.tsx`, `app/market-context-setup/page.tsx`, `app/processing/page.tsx`, `app/recommendations/page.tsx`, `app/assistant-overview/page.tsx`, `app/account-workspace/page.tsx` | Defines top-level routes for public and authenticated screens | Uses Next.js app router pattern, no `pages/` directory present. |
| Layout | `components/layout/AppShell.tsx`, `components/layout/PagePrimitives.tsx`, `app/layout.tsx` | Shared page shell, navigation layout, page header/surface primitives | `AppShell` handles public vs internal nav; `PagePrimitives` provides reusable structural components. |
| Public access | `components/access/StartAccessClient.tsx` | Home/login/demo/register access form and entry UI | Includes login, demo start, and new workspace registration. |
| Briefing | `components/market-context/MarketContextClient.tsx` | Market context setup form and inventory connection status | Captures product, category, marketplace, supplier source, goal, region, currency. |
| Orchestration | `components/processing/ProcessingClient.tsx` | Temporary processing screen coordinating assistants | Shows progress, assistant status, source mode, and redirect logic. |
| Recommendations | `components/recommendations/RecommendationsClient.tsx` | Main AMI Strategy workspace and recommendation review | Includes final recommendation, candidate tabs, evidence, supplier comparisons. |
| Assistants | `components/assistants/AssistantOverviewClient.tsx` | Assistant usage and credit management | Fetches usage from `/api/assistant-usage` and supports limit updates. |
| Control Hub | `components/workspace/AccountWorkspaceClient.tsx` | Workspace profile, linked services, inventory, saved reports, demo credits | Includes inventory source connect/resync/remove and payment mockups. |
| UI primitives | `components/ui/Badge.tsx`, `components/ui/BrightDataPill.tsx`, `components/ui/StatusDot.tsx` | Reusable badges, Bright Data pill, status indicators | Small presentational controls. |
| Styling | `app/globals.css` | global theme and Tailwind import | Defines light mode variables and basic body styling. |
| Demo/mock data | `lib/demo/data.ts`, `lib/services/ami-store.ts`, `public/demo/templates` | Demo values, workspace snapshots, sample inventory templates | Demo data drives many MVP examples and fallback states. |
| Data dependencies | `lib/schemas/ami.ts`, API fetches to `/api/*` | Defines domain models, visible assistants, business goals, and client validation | UI depends on backend API routes for workspace state, analysis, inventory, auth, and assistant usage. |

## 3. Route and Screen Map

| Route | Screen Name in Code | Intended AMI Screen | Status | Notes |
|---|---|---|---|---|
| `/` | `StartAccessClient` | Home / Access | Partially aligned | Has login/demo/register entry; missing actual pricing/overview sections and home anchors are orphaned. |
| `/market-context-setup` | `MarketContextClient` | Briefing | Aligned | Captures decision context and inventory status. |
| `/processing` | `ProcessingClient` | Orchestration State | Aligned | Shows assistant coordination and redirect to recommendations. |
| `/recommendations` | `RecommendationsClient` | AMI Strategy | Aligned | Contains recommendation workspace, evidence, and candidate tabs. |
| `/assistant-overview` | `AssistantOverviewClient` | Assistants | Aligned | Shows assistant usage, credit limits, and alerts. |
| `/account-workspace` | `AccountWorkspaceClient` | Control Hub | Aligned | Contains profile, linked services, inventory, credits, history. |

Inconsistent or old labels:
- The code uses `market-context-setup` route but the internal nav calls it `Briefing`, which is correct semantically.
- `AccountWorkspaceClient` is labeled `Control Hub`, not generic `Account` or `Workspace` in the UI.
- `RecommendationsClient` is named `AMI Strategy`, avoiding the old `dashboard` label.

## 4. Navigation Reconstruction

The navigation is implemented in `components/layout/AppShell.tsx`.

Public navigation items:
- `Powered by Bright Data` pill at left
- `How it works?` anchor link
- `Pricing` anchor link
- `New Workspace` button link to `#new-workspace`

Internal navigation items:
- `Briefing` (`/market-context-setup`)
- `AMI Strategy` (`/recommendations`)
- `Assistants` (`/assistant-overview`)
- `Control Hub` (`/account-workspace`)
- `Log out` button

Header layout:
- Top-left logo block is a square with `AMI` text and brand name subtitle in internal nav.
- Public header is a minimal bar with Bright Data pill and anchor links.
- Internal header is a sticky top bar with nav links and log out button.

Logo placement:
- Internal nav header places AMI logo plus full product name at left.
- Public header does not show the left logo block inside AppShell; the home page contains its own hero brand block.

Right-side actions:
- Internal header includes navigation links and a `Log out` button.
- Public header includes a `New Workspace` button.

Mobile behavior:
- Internal nav collapses into a `<details>` menu on small screens.
- Public nav hides `How it works?` and `Pricing` on very small screens but still shows `New Workspace`.

Active states:
- Internal nav highlights active route with teal background and border.
- Buttons use teal hover states and subtle border transitions.

Logout behavior:
- `Log out` calls `POST /api/auth/logout`, clears local storage items `ami.marketContext`, `ami.briefingContext`, and `ami.latestAnalysis`, then navigates to `/`.

Bright Data in navigation:
- `BrightDataPill` is present on the public home header and internal processing page, plus evidence and other pages.
- Bright Data appears as contextual branding rather than a persistent global nav item.

Navigation support for intended model:
- Public home nav includes all expected public items, but the actual page content does not include `How it works` / `Pricing` sections.
- Internal app nav directly supports Briefing, AMI Strategy, Assistants, and Control Hub.

| Nav Area | Current Items | Visual Behavior | Interaction | Issue / Note |
|---|---|---|---|---|
| Public header | Bright Data pill, How it works?, Pricing, New Workspace | Minimal white bar with subtle spacing | Anchor links and workspace hash link | `How it works` and `Pricing` targets are absent in content. |
| Internal header | AMI brand, Briefing, AMI Strategy, Assistants, Control Hub, Log out | Sticky bar, active item teal highlight | Route navigation and logout POST | Good mapping to intended internal structure. |
| Mobile internal | Same items in dropdown details | Small menu overlay | Click to open and navigate | Good, no mobile-specific issues in code. |

## 5. Visual Reconstruction by Screen

### Screen: Home / Access

#### Route / File
- `/`
- `app/page.tsx`
- `components/access/StartAccessClient.tsx`

#### Purpose in Current UI
Provides public entry to AMI with login, demo access, and workspace registration.

#### Intended AMI Role
Home / Access

#### Visual Layout Description
A tall entry screen divided into two columns on desktop and stacked on mobile.

- Left side:
  - A small square brand mark with `AMI` text.
  - A large hero title: `Autonomous Marketplace Intelligence`.
  - A paragraph describing AMI as a marketplace intelligence solution coordinating assistants and returning ranked business recommendations.
- Right side:
  - A rounded white panel with a border and shadow.
  - The panel contains either a login form or a registration form depending on URL hash.
  - The login form uses a vertical stack with two text inputs and two large buttons.
  - The register form is a longer multi-field grid with workspace and business profile inputs.
- The page uses light backgrounds, subtle gray borders, teal buttons, and shadow surfaces.

Color usage:
- White form card on a light page background.
- Teal buttons for primary actions.
- Gray border and text for inputs and secondary copy.

Typography and spacing:
- Large hero heading with medium line height.
- Small uppercase labels for inputs.
- Even spacing between inputs and sections.

#### Main UI Elements
- `AMI` brand block
- Hero title and descriptive paragraph
- Login form with email/workspace ID field and password field
- Primary login button
- Secondary demo start button
- Demo copy text
- Registration form with many workspace/business fields
- Error/message panel for form feedback

#### Button and Action Inventory
| Button / Action | Location | Visual Style | State(s) | Interaction | Destination / Result |
|---|---|---|---|---|---|
| `Log in` | Home panel | white button with border | enabled/disabled | submits login form | calls `/api/auth/login`; on success goes to `/market-context-setup` |
| `Start Demo Analysis` | Home panel | teal primary button | enabled/disabled | click | calls `/api/auth/demo`; stores demo briefing and navigates to `/processing` |
| `Create AMI Workspace` | Register tab | teal primary button | enabled/disabled | submits registration form | calls `/api/auth/register`; on success goes to `/market-context-setup` |

#### Interaction Flow
- Page chooses `login` or `register` based on URL hash (`#new-workspace`).
- Login form submits to `/api/auth/login`; on success, route to briefing.
- Demo button submits to `/api/auth/demo`, saves demo context in `localStorage`, and routes to processing.
- Registration form submits to `/api/auth/register`; on success, routes to briefing.
- Message panel appears if login/demo/register fails.

#### Current UI Issues
- The page mixes login, demo, and register in a panel layout that can feel like a prototype.
- There is no visible pricing or overview content even though nav anchors suggest it.
- The registration form is long and more like onboarding than a polished access entry.

#### Questions for Claude
1. Does this public entry screen feel polished enough for a hackathon home page?
2. Is the login/demo/register split appropriate or too prototype-like?
3. Should the home page be simplified to focus on demo access and product promise only?

### Screen: Briefing

#### Route / File
- `/market-context-setup`
- `app/market-context-setup/page.tsx`
- `components/market-context/MarketContextClient.tsx`

#### Purpose in Current UI
Collects decision context for AMI analysis and shows inventory connection state.

#### Intended AMI Role
Briefing

#### Visual Layout Description
A centered page with a page header and a single form inside a large white surface.

- Top header includes a teal `Briefing` badge, title `Define the decision AMI should analyze`, and descriptive text about the Orchestrator.
- A status strip below the header shows inventory connected or not connected plus a button to connect/re-sync inventory.
- If a selected business goal is inventory-dependent and inventory is missing, an amber warning panel appears.
- The form fields are arranged in a responsive multi-column flex wrap.
- Inputs include product, category, marketplace, supplier source, business goal select, region, and currency.
- The primary submit button sits below the fields.
- Validation message appears below the submit button if the payload is invalid.

Color usage:
- White surface and grey borders.
- Teal badge and submit button.
- Amber warning banner when inventory is recommended.

Typography and spacing:
- Clear form grouping with labeled fields.
- Reasonably spaced fields with a responsive wrap.

#### Main UI Elements
- `Briefing` badge
- Status strip with inventory connection and sync button
- Field inputs for product, category, marketplace, supplier source, region, currency
- Business goal dropdown with inline goal description
- Primary `Start AMI Analysis` button
- Amber warning panel for inventory-dependent goals
- Error message panel

#### Button and Action Inventory
| Button / Action | Location | Visual Style | State(s) | Interaction | Destination / Result |
|---|---|---|---|---|---|
| `Connect inventory` / `Re-sync` | Status strip | white border button | enabled | click | navigates to `/account-workspace#marketplace-setup` |
| `Start AMI Analysis` | Form bottom | teal primary button | enabled/disabled | submits briefing | validates payload and POSTs to `/api/market-context`; on success stores context and routes `/processing` |

#### Interaction Flow
- On load, the page reads localStorage for existing briefing context.
- It fetches workspace snapshot from `/api/workspace` to display inventory status.
- User edits fields and business goal; changes are persisted to localStorage immediately.
- On submit, the page validates the payload with `MarketContextPayloadSchema`; invalid payload shows an error.
- On success, it POSTs briefing to `/api/market-context`, saves it in localStorage, and redirects to processing.

#### Current UI Issues
- The inventory status section is clear, but the form does not explicitly show whether inventory is required or optional beyond one amber warning.
- The status button leads to Control Hub rather than in-context inventory setup, which is okay but may be less direct.

#### Questions for Claude
1. Does this briefing screen capture the right decision context for AMI?
2. Is the inventory status treatment clear enough for a user to understand optional vs required context?
3. Does the form structure feel advisor-focused or too data-entry oriented?

### Screen: Orchestration State

#### Route / File
- `/processing`
- `app/processing/page.tsx`
- `components/processing/ProcessingClient.tsx`

#### Purpose in Current UI
Shows AMI coordinating assistants and monitoring analysis progress.

#### Intended AMI Role
Orchestration State

#### Visual Layout Description
A white page with a top-right `Back to briefing` button and a central white surface containing the orchestration state.

- The top section includes a `BrightDataPill`, page headline, and descriptive paragraph.
- A secondary status card shows `Source mode` and its value.
- A progress card shows the AMI status label, numeric percentage, and a teal progress bar.
- If preliminary metrics are available, a metrics panel appears with four metric cards.
- The assistant list displays one card per visible assistant.
- A blue info panel at the bottom shows source data state.
- An amber message area appears if warnings occur.

Card layout:
- Assistant cards are stacked vertically with icon, title, role, activity text, state badge, and source type.
- The page uses a single column with components stacked and compact spacing.

Color usage:
- Teal accent for progress and active state.
- Amber for warning state.
- Blue for data source panel.
- Green icon for completed state.

Typography and spacing:
- Crisp section spacing and moderate whitespace.
- Small text for assistant statuses and activity descriptions.

#### Main UI Elements
- `Back to briefing` button
- `BrightDataPill`
- Page header with dynamic title
- `Source mode` card
- Progress card with percentage and progress bar
- Preliminary metrics panel (conditional)
- Assistant cards for orchestrator, inventory, trend, competitor, supplier
- Data source state info panel
- Warning/error message panel

#### Button and Action Inventory
| Button / Action | Location | Visual Style | State(s) | Interaction | Destination / Result |
|---|---|---|---|---|---|
| `Back to briefing` | Top right | white border button | enabled | click | routes to `/market-context-setup` and aborts analysis poll |

#### Interaction Flow
- On mount, the component reads briefing context from localStorage; missing context redirects to briefing with an error.
- It starts analysis by POSTing to `/api/analysis/start`.
- It polls `/api/analysis/{runId}` until the analysis reaches a terminal state.
- Assistant cards update from pending to running/completed or warning/failed.
- If analysis completes, the page waits a minimum visible duration and then navigates to `/recommendations`.
- Errors during start or polling display amber message panels and set assistant failure states.
- Clicking `Back to briefing` aborts the analysis fetch and clears latest analysis from localStorage.

#### Current UI Issues
- The screen includes preliminary metrics, which may draw attention away from the assistant coordination story.
- There may be too much detail for a temporary loading state, especially with assistant cards and fallback signals.

#### Questions for Claude
1. Does this orchestration page feel like a temporary assistant coordination state?
2. Are the assistant cards strong evidence of AMI coordinating specialists?
3. Should preliminary metrics be delayed until the main strategy workspace?

### Screen: AMI Strategy

#### Route / File
- `/recommendations`
- `app/recommendations/page.tsx`
- `components/recommendations/RecommendationsClient.tsx`

#### Purpose in Current UI
Delivers the main recommendation workspace, showing final recommendation, assistant signals, candidate selections, evidence, and supplier comparison.

#### Intended AMI Role
AMI Strategy

#### Visual Layout Description
A long page with a header section, summary panels, signal cards, export section, tabbed content, and evidence/detail drawers.

- Top header includes a teal `AMI Strategy` badge, business goal label, last analysis timestamp, source mode, and `BrightDataPill`.
- A summary section shows the final recommendation title, recommendation summary, and badges for score, risk, confidence, and opportunity type.
- A right-hand panel shows primary metrics in a small card with demand, trend, supplier, estimated margin, and ROI.
- A data quality banner appears if issues are present.
- A signals section lists assistant findings or contribution summaries with badges and assistant names.
- A `Partner’s Choice` selection panel exists for exporting selected items.
- Tab navigation controls five tabs: Product Candidates, Promo Candidates, Inventory Actions, Supplier Comparison, Evidence & Reasoning.
- The active tab displays card summaries or supplier tables and can open drawers for item details.
- Evidence and reasoning appear in expandable `details` panels under the tab content.
- A final amber panel states that AMI does not automate purchasing and that approved recommendations go to Control Hub.

Layout:
- The page uses a narrow centered shell with full-width stacked sections.
- The recommendation summary and metrics are arranged in a two-column grid on desktop.
- Tab content often uses card grids and lists with selection checkboxes.

Color usage:
- Neutral whites and grays with teal badges and borders.
- Amber banners for quality issues.
- Blue `BrightDataPill` and evidence highlight.

Typography and spacing:
- Large headline for the business goal.
- Bold recommendation text and smaller supporting copy.
- Clear headings for sections and moderate vertical space.

#### Main UI Elements
- `AMI Strategy` badge
- Business goal headline and metadata line
- Final recommendation section with summary and badges
- Primary metrics panel
- Data quality / fallback warning banner
- Strategy signals list with risk badges and assistant names
- Partner’s Choice selection panel with export button
- Tab bar with five strategy tabs
- `SelectablePaginatedTab` card components for product/promo/inventory rows
- Supplier comparison table with selection controls
- Evidence & Reasoning details panels and comparison rows
- Drawer overlays for item and supplier details
- Amber purchasing disclaimer panel

#### Button and Action Inventory
| Button / Action | Location | Visual Style | State(s) | Interaction | Destination / Result |
|---|---|---|---|---|---|
| `Export AMI Report` | Partner’s Choice bar | white border button | enabled/disabled | click | sets placeholder message; no real export implemented |
| Tab buttons | Tab bar | text buttons with underline | active/hover | click | switches tab content |
| `Previous` / `Next` | Paginated tab footer | small border buttons | disabled/active | click | change page index within candidate lists |
| Candidate card checkbox | Card list | checkbox | checked/unchecked | click | toggles selection state |
| `View details` | Candidate cards | card-level action | click | opens drawer detail |
| Detail drawer close | Drawer | icon button | click | closes drawer overlay |
| Supplier selection toggle | Supplier comparison table | checkbox controls | click | toggles selected supplier IDs |

#### Interaction Flow
- On mount, the page loads analysis from query param `runId` or localStorage.
- If no analysis exists, it redirects to briefing.
- The recommendation summary uses `selectedId` state to track the chosen recommendation.
- Tab selection changes the active content area.
- Product/promo/inventory rows are generated from analysis opportunities and findings.
- Selected candidates can be toggled and counted.
- Export button only displays a placeholder message when selections exist.
- Evidence panel loads a default evidence package or shows placeholder text when missing.
- Drawers lock body scroll and close on Escape.

#### Current UI Issues
- The main recommendation hierarchy exists, but candidate tabs and supplier comparison create a more dashboard-like interaction.
- Evidence is tucked into the fifth tab and a details panel rather than fully surfaced within the main recommendation summary.
- The export action is a placeholder and not yet functional.
- The page’s selected candidate feature may overcomplicate the MVP recommendation story.

#### Questions for Claude
1. Does the top section present recommendation hierarchy clearly enough for an advisor product?
2. Is the tabbed candidate selection structure too dashboard-like for AMI Strategy?
3. Should evidence be moved higher in the page or more directly connected to the final recommendation?

### Screen: Assistants

#### Route / File
- `/assistant-overview`
- `app/assistant-overview/page.tsx`
- `components/assistants/AssistantOverviewClient.tsx`

#### Purpose in Current UI
Displays assistant usage, credit limits, source activity, and alert states.

#### Intended AMI Role
Assistants

#### Visual Layout Description
A page header followed by a vertical list of assistant sections.

- Header contains `Assistants` badge, title, and description.
- Each assistant section is separated by borders and includes the assistant name, role, latest contribution, and data sources.
- A badge indicates alert state such as normal, near limit, exceeded, or paused.
- Usage facts are displayed in a row with runs, cost, and a credit utilization bar.
- Each section includes a small form to edit the assistant credit limit.
- Alerts appear below the form when an assistant is near or over limit.

Color usage:
- Neutral card backgrounds and teal for normal info.
- Amber for near-limit warnings and red for exceeded/paused.

Typography and spacing:
- Clear headings for assistant names.
- Small text for contributions and sources.
- Compact section spacing with border separators.

#### Main UI Elements
- `Assistants` badge and page header
- Assistant name and role
- Latest contribution summary
- Data sources used text line
- Alert badge and status copy
- Usage facts row with runs, cost, and credit bar
- Credit limit input form with save icon button
- Alert panel for threshold states

#### Button and Action Inventory
| Button / Action | Location | Visual Style | State(s) | Interaction | Destination / Result |
|---|---|---|---|---|---|
| Save credit limit | Assistant section | icon-only teal button | enabled | submits form | PATCH `/api/assistant-usage` and updates local usage state |

#### Interaction Flow
- On mount, the page fetches `/api/assistant-usage`.
- It maps usage payloads to visible assistants.
- User can edit numeric credit limit for each assistant.
- Form submission updates the limit via API and refreshes the displayed usage item.
- Messages show success or failure.

#### Current UI Issues
- The page is focused on usage management and credit rather than assistant reasoning.
- It includes the `orchestrator` assistant in the visible list, which may conflict with the intended four specialized assistants.

#### Questions for Claude
1. Does this usage screen read as an assistant control area rather than analytics?
2. Is the use of credit limit editing appropriate for MVP?
3. Should the `orchestrator` role be visible here or hidden as an internal coordination role?

### Screen: Control Hub

#### Route / File
- `/account-workspace`
- `app/account-workspace/page.tsx`
- `components/workspace/AccountWorkspaceClient.tsx`

#### Purpose in Current UI
Manages workspace profile, linked services, inventory connection, credits, and recommendation history.

#### Intended AMI Role
Control Hub

#### Visual Layout Description
A page header with a details-driven layout, including multiple accordion-style panels for profile, services, payment, credits, marketplace setup, inventory, saved reports, and recommendation history.

- Header shows `Control Hub` badge, title, and description.
- The page displays a success/error message bar when actions occur.
- Several `details` sections are always open and contain grouped `Panel` cards.
- Personal Information, Linked Services, Payment Method, Demo Credits appear in a top row of panels.
- Marketplace Setup, Inventory Context, Saved Reports, and Approved Recommendation History appear in a second row.
- Inventory setup includes a large form with connection type, credential input, file upload, and action buttons.
- There is a footer note explaining mock payment/demo status.

Color usage:
- Neutral surfaces and teal badges.
- Amber callout for demo payment mockup and warnings.
- Green for connected inventory status.

Typography and spacing:
- Section titles and facts are clearly separated.
- Dense information layout with many fields and panels.

#### Main UI Elements
- `Control Hub` badge and header
- Personal profile facts
- Linked services facts including Bright Data status
- Payment method mockup panel
- Demo credits facts
- Marketplace profile facts
- Inventory sync status card
- Inventory connection form with marketplace URL, connection type, credential input, file upload, and buttons
- Saved reports list panel
- Approved recommendation history list panel
- Footer explanatory note about demo/mock data

#### Button and Action Inventory
| Button / Action | Location | Visual Style | State(s) | Interaction | Destination / Result |
|---|---|---|---|---|---|
| Edit payment method | Payment panel | white border button | enabled | toggles payment mock form | no backend action shown |
| Remove payment method | Payment panel | white border button | enabled | toggles local payment state | updates message locally |
| Connect Inventory Source | Inventory form | teal primary button | enabled/disabled | submits form | POST `/api/inventory/connect` |
| Re-sync Inventory | Inventory form | white border button | enabled/disabled | click | POST `/api/inventory/sync` |
| Remove Inventory Source | Inventory form | white border button | enabled/disabled | click | DELETE `/api/inventory/connect` |

#### Interaction Flow
- On mount, the page fetches `/api/workspace` and loads snapshot data.
- Inventory form inputs update local state.
- File upload validates CSV or JSON file type and content locally.
- Connect action POSTs inventory payload and updates snapshot state.
- Re-sync action posts sync request and updates status.
- Remove action clears inventory source via API.
- Payment buttons toggle local mock state; these do not appear to call backend.

#### Current UI Issues
- Inventory configuration is extensive, including credentials and file uploads, which may exceed lightweight control hub scope.
- The `Payment method` panel is a demo mockup and may confuse users if presented as real.
- The saved reports panel is included but the actual save action is not visible within the recommendations page.

#### Questions for Claude
1. Is this control hub scope appropriate for MVP, or should it be simplified?
2. Does the inventory form feel too close to full inventory management?
3. Should the payment section be hidden or labeled more clearly as future-facing mockup?

## 6. Component Inventory

| Component | File | Used In | Visual Role | States | Notes |
|---|---|---|---|---|---|
| `AppShell` | `components/layout/AppShell.tsx` | All pages | Layout shell, navigation wrapper | public mode / internal mode | Controls public and internal nav. |
| `PageShell` | `components/layout/PagePrimitives.tsx` | Briefing, Assistants, Recommendations, Control Hub | Page content wrapper | normal | Standard page width and padding. |
| `PageHeader` | `components/layout/PagePrimitives.tsx` | Briefing, Assistants, Control Hub | Section header | normal | Page title, description, actions. |
| `Surface` | `components/layout/PagePrimitives.tsx` | Many screens | Card/container surface | normal | White surface with border/shadow. |
| `StatusStrip` | `components/layout/PagePrimitives.tsx` | Briefing | Status card strip | normal | Inventory status and action. |
| `Badge` | `components/ui/Badge.tsx` | Many screens | Small tone badge | neutral/blue/teal/amber/red/green | Used for status and risk. |
| `BrightDataPill` | `components/ui/BrightDataPill.tsx` | Home, processing, evidence | Brand/context pill | normal | Highlights Bright Data usage. |
| `StatusDot` | `components/ui/StatusDot.tsx` | Processing assistant cards | Status indicator | teal/amber/red/green/slate | Used in assistant state rows. |
| `Assitant usage form` | `components/assistants/AssistantOverviewClient.tsx` | Assistants page | Credit limit update | normal | Uses native number input + save button. |
| `SelectablePaginatedTab` | `components/recommendations/RecommendationsClient.tsx` | AMI Strategy | Card grid list | selected/paginated | Renders candidate row cards. |
| `Drawer` | `components/recommendations/RecommendationsClient.tsx` | AMI Strategy | Details overlay | open/close | Locks scroll on open. |
| `MetricPreview` | `components/processing/ProcessingClient.tsx` | Orchestration | Metric card | normal | Preliminary metrics. |

## 7. State and Interaction Inventory

| UI Area | State | How It Appears | Trigger | Current Behavior | Issue / Note |
|---|---|---|---|---|---|
| Home login | default | login fields shown | default | shows login form | normal |
| Home register | default | register fields shown | `#new-workspace` hash | shows long registration form | may feel heavyweight |
| Home demo | normal | demo button enabled | click | starts demo flow | good |
| Briefing inventory | connected | status strip green text | API workspace snapshot | button reads `Re-sync` | good |
| Briefing inventory | not connected | status strip grey | API snapshot | button reads `Connect inventory` | good |
| Briefing validation | error | amber message panel | invalid payload | shows generic error | could improve detail |
| Processing progress | pending/running | progress bar + assistant cards | network polling | updates assistant statuses | good |
| Processing failed | failed | amber message and red icon state | API error | shows failure message | good |
| Strategy candidate | selected | checkbox checked | click row | toggles selection | UI heavy |
| Strategy tab | active | teal underline | click tab | switches content | standard |
| Strategy export | disabled | button disabled | no selection | cannot export | placeholder only |
| Assistants normal | normal | green badge | API usage payload | shows usage counts | good |
| Assistants near limit | warning | amber badge + description | API payload | shows threshold warning | good |
| Assistants exceeded | error | red badge | API payload | shows exceeded state | good |
| Control inventory | connected | green badge | API snapshot | shows sync status | good |
| Control inventory | syncing | blue badge | sync action | shows syncing status | good |
| Control inventory | error | red badge | API error | shows error message | good |
| Payment mock | info | amber panel | local state | shows demo disclaimer | good |

## 8. Forms and Validation Audit

| Form | Fields | Required Fields | Validation | Submit Behavior | Error Handling |
|---|---|---|---|---|---|
| Login | Email/workspace ID, Password | both required | none beyond HTML required | POST `/api/auth/login` | message panel on failure |
| Register | Name, Email, Password, Workspace name/type, region/currency, business name/type, marketplace, category, region | all required | none beyond HTML required | POST `/api/auth/register` | message panel on failure |
| Briefing | Product, Category, Marketplace, Supplier source, Business goal, Region, Currency | all required | schema validation via `MarketContextPayloadSchema` | POST `/api/market-context` | amber message panel on error |
| Inventory connection | Marketplace name, marketplace URL (conditional), connection type, credential (conditional), file upload (conditional) | mostly required based on connection type | local file type validation and required-field checks | POST `/api/inventory/connect` | message panel on error |
| Inventory re-sync | none | n/a | n/a | POST `/api/inventory/sync` | message panel on failure |
| Inventory remove | none | n/a | n/a | DELETE `/api/inventory/connect` | message panel on failure |
| Credit limit | numeric credit limit | required | number between 10 and 5000 | PATCH `/api/assistant-usage` | message panel on error |

Validation notes:
- Most forms use HTML required attributes and some local checks.
- Briefing payload is validated with Zod schema after form submission.
- File upload validation is local and checks extension/mime.
- Payment fields are mock-only and do not appear to be sent to backend.
- There is no visible form-specific inline validation text beyond general message panels.

## 9. Visual Style Audit

| Visual Area | Current Appearance | Target Fit | Issue / Note |
|---|---|---|---|
| Page surfaces | White cards, subtle border, shadow | Strong | Good enterprise SaaS feel |
| Accent palette | Teal primary, amber warnings, red errors | Strong | Fits target palette |
| Typography | Clean headings, small labels, body text | Strong | Good hierarchy in most screens |
| Navigation | Minimal public header, sticky internal header | Strong | Good separation |
| Dashboard density | Tabbed cards and tables in strategy | Moderate | Tends toward analytics dashboard feel |
| Hero entry | Large title and login/register card | Moderate | feels functional but not polished landing page |
| Control Hub | Dense info panels and forms | Moderate | may be too detailed for lightweight hub |

The general style is light and restrained, with no dark-mode or sci-fi AI aesthetic. The main visual risk is that some pages still feel like generic dashboard interfaces due to tabbed lists and dense form panels.

## 10. Copy and Tone Audit

| Location | Current Copy | Issue | Suggested Direction |
|---|---|---|---|
| Home hero | `AMI reviews marketplace context, social trends, inventory status, coordinates specialized assistants, and returns a ranked business recommendation...` | strong advisor tone | keep |
| Home login panel | `Enter AMI with a prepared workspace` | slightly bureaucratic | refine to simpler access language |
| Assistants page description | `Monitor AMI agents, credit limits, source activity, and threshold states.` | uses `agents` instead of `assistants` | align terminology to assistants |
| Strategy panel | `Partner’s Choice` | promotional / productized phrase | consider more direct advisory wording |
| Evidence tab | `Assistant reasoning and technical details` | good descriptive tone | keep |
| Control Hub payment note | `Real payment processing is not active in this MVP.` | good transparency | keep, but consider hiding in MVP |
| Processing status | `AMI is preparing strategy workspace` | good advisor tone | keep |

The current copy is generally professional and calm, with a strong focus on recommendation and analysis. A few areas use more generic or promotional wording and could be tightened.

## 11. Evidence and Trust UI Audit

The UI exposes trust signals in the following ways:
- Confidence badges on final recommendations and assistant contributions.
- Risk badges on final recommendation and strategy signals.
- Data quality banner when source collection or fallback issues exist.
- `Source mode` labels such as Live, Demo, Fallback.
- Bright Data evidence fields in the Evidence tab.
- Assistant contribution summaries with status badges and latest contributions.
- `Collected at` and `Analysis run` metadata in the evidence section.

Evidence visibility:
- Evidence is primarily available on demand in the `Evidence & Reasoning` tab and details panels.
- The main recommendation summary does not show raw source evidence directly.

Missing or weak trust elements:
- Match quality is shown in evidence fields but not highlighted in the top recommendation section.
- Fallback mode is labeled, but not always explained in the main recommendation hierarchy.
- Source provenance is not deeply visible without opening drawers.

## 12. Bright Data Visibility Audit

| Location | How Bright Data Appears | Is It Contextual? | Issue / Note |
|---|---|---|---|
| Public header | `Powered by Bright Data` pill | Yes | clear branding without clutter |
| Processing page | `BrightDataPill` near page title | Yes | reinforces data source during orchestration |
| Recommendations evidence | `Bright Data product`, `Bright Data mode` fields | Yes | contextual evidence detail |
| Control Hub linked services | `Bright Data status` fact | Yes | connection status visible |
| Assistants demo data | `dataSourcesUsed` strings mention Bright Data | Yes | good source footprint |

Bright Data is visible and contextual rather than overexposed. It appears in the right places for a hackathon evaluation.

## 13. Data Visualization and Metrics Audit

| Visualization | Location | Purpose | Supports Decision? | Issue / Note |
|---|---|---|---|---|
| Progress bar | Orchestration screen | Shows analysis progress | Yes | effective |
| Preliminary metric cards | Orchestration screen | Opportunity/Margin/Demand/Product count | Yes | may be premature in processing state |
| Badges | Strategy and assistant screens | Show score, risk, confidence, alert state | Yes | good for quick interpretation |
| Credit usage bar | Assistants screen | Shows credits used vs limit | Yes | good usage signal |
| Supplier comparison table | Strategy screen | Compare suppliers | Yes | supports supplier decisioning |
| Candidate card list | Strategy screen | Product/promo/inventory items | Yes | supports selection but adds dashboard feel |

There are no complex charts. The visualizations are restrained and mainly badge/table/card based, which fits the advisor target.

## 14. Responsiveness Audit

| Screen / Component | Current Responsive Behavior | Issue / Note |
|---|---|---|
| Internal nav | collapses to dropdown on small screens | good |
| Home hero | columns stack on mobile | good |
| Briefing form | fields wrap responsively | good |
| Processing assistant cards | stack vertically | good |
| Strategy candidate grid | 2-column on mid/big screens, 1-column on small | good |
| Supplier comparison | table may overflow if too wide | likely handled by native table behavior |
| Evidence panels | details sections stack | good |

Responsive behavior is implemented in the component layouts and likely adequate for mobile, though the strategy page remains content-heavy.

## 15. Accessibility Audit

| Area | Accessibility Concern | Severity | Suggested Direction |
|---|---|---|---|
| Page semantics | `details` elements used for evidence sections | Low | ensure summary labels are descriptive and keyboard accessible |
| Loading state | Recommendations page returns `null` while loading | Medium | add explicit loading UI or fallback state |
| Form labels | input components use label wrappers | Low | good |
| Button labels | icon-only save button has `aria-label` | Low | good |
| Contrast | text uses dark headings on light background | Low | good |
| Error alerts | messages use colored backgrounds and text | Low | good |
| Focus states | custom focus rings appear in CSS | Low | good |

The UI uses good HTML semantics and labels, but the main strategy route may need a stronger loading/fallback state.

## 16. Implementation Risk Audit

| Risk | File / Area | Impact | Suggested Direction |
|---|---|---|---|
| Hardcoded assistants | `lib/schemas/ami.ts` and multiple components | medium | visible assistant count may be brittle; centralize model and avoid showing orchestrator as separate assistant |
| Demo state dependency | `components/access/StartAccessClient.tsx`, `lib/demo/data.ts` | medium | many screens depend on demo data and may not reflect live state |
| Orphan nav anchors | `components/layout/AppShell.tsx` | low | remove or implement `How it works` and `Pricing` sections |
| Blank strategy screen | `components/recommendations/RecommendationsClient.tsx` | high | needs explicit loading/error state when analysis data is absent |
| Inventory complexity | `components/workspace/AccountWorkspaceClient.tsx` | medium | may exceed MVP scope and confuse product intent |
| Placeholder actions | `Export AMI Report` in recommendations | medium | should be clearly labeled as not implemented if present in UI |
| Payment mock | `AccountWorkspaceClient.tsx` | low | should be explicitly labeled as demo/future-facing |
| Data dependencies | `/api/*` fetches throughout UI | medium | UI assumes backend availability which is fine but could fail in demo without API mocks |

## 17. Priority Fix List

| Priority | Issue | Affected Area | Why It Matters | Suggested Direction |
|---|---|---|---|---|
| P0 | Missing homepage section targets | Home / Access | public entry feels unfinished | remove broken anchors or add matching sections |
| P0 | Strategy page can render blank without analysis | AMI Strategy | user may see empty screen | add loading/error fallback UI |
| P1 | Control Hub inventory is too detailed | Control Hub | risks overbuilding MVP | simplify inventory actions and surface only status/connect/resync |
| P1 | Orchestrator visible as assistant | Processing / Assistants | confuses assistant model | treat orchestrator as internal coordinator only |
| P1 | Evidence hidden in tab | AMI Strategy | trust signals not immediately visible | surface evidence summary closer to final recommendation |
| P2 | Home entry feels prototype-like | Home / Access | weak first impression | simplify login/demo/register flow |
| P2 | `Export AMI Report` placeholder is confusing | AMI Strategy | gives impression of incomplete feature | label it clearly or hide until functional |
| P2 | Payment mockup appears as real panel | Control Hub | can reduce credibility | mark as demo/future feature more clearly |

## 18. Claude Review Package

### What Claude Should Know Before Reviewing
- The current AMI UI is structured around a six-screen MVP architecture with public access, briefing, orchestration, recommendation strategy, assistant usage, and control hub.
- It is implemented in Next.js with a shared `AppShell` layout and light enterprise styling.
- The UI strongly supports advisor language, final recommendation presentation, and Bright Data visibility, but it also contains dashboard-like tabbed candidate selections and dense inventory/setup panels.
- Primary risks are blank strategy load states, inventory complexity, orphaned home nav anchors, and the visible orchestrator assistant role.
- Most interfaces are built with reusable page primitives, badges, and status indicators.

### Questions for Claude
1. Does the current screen architecture match the intended AMI MVP flow?
2. Does the public home entry feel like a polished product or still too prototype-like?
3. Is the briefing screen sufficient for decision context and inventory status?
4. Does the orchestration screen convincingly show AMI coordinating assistants?
5. Is the recommendations workspace still too dashboard-like for an advisor product?
6. Is evidence and trust shown in the right places, or should it be moved earlier?
7. Does the assistants screen provide credible usage control without overcomplicating the MVP?
8. Is the Control Hub scope too large, or is it an acceptable workspace overview?
9. Does Bright Data appear contextual enough, or does it need a stronger explanatory anchor?
10. Is the page hierarchy and visual direction consistent with light enterprise SaaS?
11. Are there any missing or misleading interaction states in the current description?
12. Would this UI be credible for a hackathon evaluation as described?
13. Should the orchestrator role be visible as a separate assistant card?
14. Does the home navigation need actual `How it works` and `Pricing` content to feel complete?
15. Are there any critical accessibility or loading state concerns that require immediate attention?

## Files inspected

- `app/page.tsx`
- `app/market-context-setup/page.tsx`
- `app/processing/page.tsx`
- `app/recommendations/page.tsx`
- `app/assistant-overview/page.tsx`
- `app/account-workspace/page.tsx`
- `app/layout.tsx`
- `app/globals.css`
- `components/layout/AppShell.tsx`
- `components/layout/PagePrimitives.tsx`
- `components/access/StartAccessClient.tsx`
- `components/market-context/MarketContextClient.tsx`
- `components/processing/ProcessingClient.tsx`
- `components/recommendations/RecommendationsClient.tsx`
- `components/assistants/AssistantOverviewClient.tsx`
- `components/workspace/AccountWorkspaceClient.tsx`
- `components/ui/Badge.tsx`
- `components/ui/BrightDataPill.tsx`
- `components/ui/StatusDot.tsx`
- `lib/schemas/ami.ts`
- `lib/services/ami-store.ts`
- `lib/demo/data.ts`
- `public/demo/templates/inventory-template.csv`
- `public/demo/templates/inventory-template.json`

## Routes inspected

- `/`
- `/market-context-setup`
- `/processing`
- `/recommendations`
- `/assistant-overview`
- `/account-workspace`

## Components inspected

- `AppShell`
- `PageShell`
- `PageHeader`
- `Surface`
- `StatusStrip`
- `StartAccessClient`
- `MarketContextClient`
- `ProcessingClient`
- `RecommendationsClient`
- `AssistantOverviewClient`
- `AccountWorkspaceClient`
- `Badge`
- `BrightDataPill`
- `StatusDot`

## Assumptions made

- The UI is interpreted from component code rather than a rendered browser image.
- API endpoints are assumed to exist based on fetch calls in the code.
- Demo data in `lib/demo/data.ts` reflects the intended example content for the MVP.
- `How it works` and `Pricing` nav anchors were intended to link to same-page sections that are not currently implemented.

## Areas that could not be verified

- exact visual styling as rendered in a browser
- runtime behavior of the API endpoints
- whether there is any hidden mobile-specific or browser-specific CSS not visible in inspected files
- actual data returned from live analysis or demo endpoints
- any private backend-only routes or integration logic outside the inspected UI files
