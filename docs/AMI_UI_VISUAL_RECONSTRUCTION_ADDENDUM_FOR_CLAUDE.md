# AMI UI Visual Reconstruction Addendum for Claude

## 1. Visual Summary

The current AMI UI is a light, enterprise-leaning experience with restrained color and moderate spacing. It uses white and slate surfaces, soft border strokes, and teal accents for primary actions and contextual branding. Visual density is moderate: content is grouped into panels and cards with enough whitespace to separate sections, but the pages are still information-rich and text-heavy.

The UI feels more like an advisor dashboard than a generic analytics console. It leans into a professional business tool aesthetic rather than a consumer-grade marketing site. However, some areas still feel overly technical and dashboard-like because of dense tables, many status badges, and several nested details.

Cards and panels are the main structural elements. Reusable surfaces appear as:
- rounded white cards with border and shadow (`Surface`, `Panel`, `DetailPanel`)
- muted slate background strips for status rows and sidebar-like blocks
- pill badges and small status chips for metadata

The overall direction is light enterprise SaaS with teal as the primary brand hue, amber for warnings, red for critical states, and neutral gray for secondary information. It does not adopt a dark-mode aesthetic. The visual style generally supports AMI as an intelligence advisor, but the text-heavy “control hub” and “assistant usage” pages risk feeling like operational tooling.

Main visual inconsistencies:
- the public home header exposes anchors for `#how-it-works` and `#pricing`, but the current page content does not define those sections.
- the `/recommendations` page has multiple nested panels and drawers, creating a complex hierarchy that can feel inconsistent with a streamlined advisor workflow.
- the `/account-workspace` page mixes mock payment details, inventory workflows, and saved-history panels in one long page, which can feel broader than an MVP control hub.

## 2. Screen-by-Screen Visual Reconstruction

## Screen: Home

### Route and Files
- Route: `/`
- Files: `app/page.tsx`, `components/access/StartAccessClient.tsx`, `components/layout/AppShell.tsx`

### Visual Layout
The screen begins with a thin top nav bar containing a `BrightDataPill` brand chip and three text buttons: `How it works?`, `Pricing`, and `New Workspace`. Below that, the page is centered in a wide two-column layout on desktop and a stacked vertical layout on mobile.

The left side contains a simple branded hero panel:
- a small `AMI` badge block
- large page title `Autonomous Marketplace Intelligence`
- one paragraph of descriptive copy

The right side is a white rounded card with a thin border and soft shadow. It contains either:
- a login form with email/workspace ID, password, a primary `Log in` button, a secondary `Start Demo Analysis` button, and status copy; or
- a registration form with many text fields arranged in responsive rows.

Spacing is moderate, with generous gaps between the hero and form. The form card uses a compact panel density but still provides plenty of breathing room, especially between the input fields.

### Main Buttons and Actions
| Button / Action | Location | Visual Priority | State(s) | Interaction | Destination / Result |
|---|---|---|---|---|---|
| Start Demo Analysis | login form card | primary (teal) | default, loading | click | `POST /api/auth/demo`, set localStorage, push `/processing` |
| Log in | login form card | secondary | default, loading | submit | `POST /api/auth/login`, push `/market-context-setup` |
| Create AMI Workspace | register form card | primary (teal) | default, loading | submit | `POST /api/auth/register`, push `/market-context-setup` |
| New Workspace | header nav | low | default | click | anchor `#new-workspace`, toggles register panel via hash |
| How it works? | header nav | low | default | click | anchor `#how-it-works` |
| Pricing | header nav | low | default | click | anchor `#pricing` |

### UI States
| State | Where It Appears | Visual Behavior | Trigger | Notes |
|---|---|---|---|---|
| default | login/register forms | normal white card with border | initial load | standard desktop layout |
| loading | login/register buttons | disabled / spinner state implied by `busy` | submit form | button disabled during fetch |
| disabled | button elements | disabled styling via HTML disabled | busy state | no custom spinner visible in markup |
| error | login/register message | amber feedback box | failed API response | generic error message shown |
| demo mode | public home form | `Start Demo Analysis` label and copy | clicking demo button | not a persistent UI state but flow begins |
| empty | not applicable | no empty state rendered | n/a | login/register always visible |

### Interaction Flow
User lands on the public home page and sees the hero panel with product positioning. They can either log in or start a demo. Clicking `Start Demo Analysis` triggers demo auth, stores context in localStorage, and navigates to `/processing`. Hash anchors control whether the registration section is active, with `#new-workspace` showing the registration panel.

### Visual / UX Issues
- Home nav links reference in-page sections that are not present.
- The registration form is very long and may overload first-time users.
- The login/workspace entry card fits the page but feels like an onboarding utility rather than a polished landing page.

---

## Screen: Market Context Setup

### Route and Files
- Route: `/market-context-setup`
- Files: `app/market-context-setup/page.tsx`, `components/market-context/MarketContextClient.tsx`, `components/layout/PagePrimitives.tsx`, `components/ui/Badge.tsx`

### Visual Layout
This page uses a centered `PageShell` container capped at a medium width. At the top is a header section with a teal `Briefing` badge, large title, and descriptive copy.

Below, a `Surface` card contains:
- a `StatusStrip` row showing inventory connectivity and a connect/re-sync button
- an optional amber warning panel if inventory-dependent goals are selected without inventory connected
- a form area with a responsive grid of fields
- a primary `Start AMI Analysis` button centered at the bottom

The form fields are arranged in flexible rows and wrap on smaller screens. The business goal is a select field with description text beneath it. Region and currency fields sit together in a smaller grouped row.

Visual hierarchy is straightforward: header, status strip, form, primary action. The page feels clear and professional with moderate density.

### Main Buttons and Actions
| Button / Action | Location | Visual Priority | State(s) | Interaction | Destination / Result |
|---|---|---|---|---|---|
| Start AMI Analysis | bottom of form | primary | default, loading | submit | `POST /api/market-context`, push `/processing` |
| Connect inventory / Re-sync | StatusStrip | secondary | default | click | push `/account-workspace#marketplace-setup` or trigger inventory sync flow indirectly |
| business goal select | form | input | default | choose option | updates state and can trigger warning message |

### UI States
| State | Where It Appears | Visual Behavior | Trigger | Notes |
|---|---|---|---|---|
| default | form panel | white card with border and shadow | normal load |
| warning | inventory goal notice | amber bordered box | selecting inventory-dependent goal when inventory is disconnected |
| connected | status strip | text indicates inventory connected | fetched workspace state |
| not connected | status strip | text indicates inventory not connected | workspace state absent |
| loading | form submit button | disabled while request pending | submit | `busy` state |
| empty | not applicable | no explicit empty state for form | n/a |
| demo mode | inventory status message | copy mentions demo snapshot if no real inventory | local state from API fetch |

### Interaction Flow
The user enters market context values and may see inventory connectivity status at the top. If the selected goal requires inventory and inventory is disconnected, an amber alert appears. Submitting the form saves the briefing context, updates localStorage, and routes to `/processing`.

### Visual / UX Issues
- The inventory status strip and connect button create two separate actions: one to connect and another to start briefing, which may confuse new users.
- The page lacks an explicit empty state for failed workspace load before redirect.

---

## Screen: Processing

### Route and Files
- Route: `/processing`
- Files: `app/processing/page.tsx`, `components/processing/ProcessingClient.tsx`, `components/layout/PagePrimitives.tsx`, `components/ui/BrightDataPill.tsx`, `components/ui/StatusDot.tsx`

### Visual Layout
A centered page frame houses a single large white card with border and shadow. The top section includes the `AMI` brand badge, a big title, and supporting copy. A right-aligned card shows `Source mode` with a label.

Below is a status block with:
- a radar icon
- current AMI status text
- a progress percentage
- a horizontal progress bar with teal fill

If preliminary metrics are available, a nested white card appears with a four-column metric preview grid.

Next, a vertical list presents assistant status rows. Each row has:
- a status icon (check, shield, or dashed circle)
- assistant name and role
- live activity text and optional fallback/missing signal details
- a status chip with `Selected`, `Warning`, `Failed`, or `Completed`
- source type label

A blue callout panel at the bottom reinforces data source status.

### Main Buttons and Actions
| Button / Action | Location | Visual Priority | State(s) | Interaction | Destination / Result |
|---|---|---|---|---|---|
| Back to briefing | top right | secondary | default | click | push `/market-context-setup` |
| Cancel analysis | same button | secondary | default | click | abort fetches, clear localStorage, push `/market-context-setup` |

### UI States
| State | Where It Appears | Visual Behavior | Trigger | Notes |
|---|---|---|---|---|
| default | orchestration card | active teal progress, assistant rows | initial/polling | normal state |
| running | assistant rows | `CircleDashed`, blue or teal tone | assistant state set to running |
| completed | assistant rows | `CheckCircle2`, green tone | assistant finished |
| warning | assistant rows or message box | amber tone and icon | fallback, missing data, inventory warning |
| failed | assistant rows and message box | red tone | analysis/polling failure |
| demo mode | source text | uses `Demo` label and fallback copy | state from result mode |
| fallback mode | source text | `Fallback` / `Fallback snapshot` labels | state from source collection |
| 90% usage alert | not present here | N/A | N/A | this page has no credit usage state |
| error | top message box | amber background | fetch failure or invalid context |

### Interaction Flow
On load, the page validates localStorage briefing context. If context is missing or invalid, it redirects back to briefing. It starts the analysis request, updates assistant rows in staged progress increments, and polls until terminal state. When done, it writes the latest analysis to localStorage and redirects to `/recommendations` after a brief delay.

### Visual / UX Issues
- The page uses large status sections but may be too procedural for users who expect a single clear next step.
- The progress bar and assistant list are appropriate for backend orchestration, but the page may feel more like a processing monitor than an advisor workspace.
- There is no visible retry button for failed analysis; only a message appears.

---

## Screen: Recommendations

### Route and Files
- Route: `/recommendations`
- Files: `app/recommendations/page.tsx`, `components/recommendations/RecommendationsClient.tsx`, `components/layout/PagePrimitives.tsx`, `components/ui/Badge.tsx`, `components/ui/BrightDataPill.tsx`, `components/ui/StatusDot.tsx`

### Visual Layout
The page begins with a wide strategy header in a `PageShell`. The top area has a teal `AMI Strategy` badge, a business goal title, metadata rows, and a `Bright Data` badge.

Below the header, warnings render in a full-width amber callout panel. Then a primary section labeled `AMI Strategy Signals` shows a vertical stack of assistant signals. Each signal card includes a risk badge, finding title, reason text, and assistant name.

A `Partner’s Choice` selection panel follows with a pale background and summary text. A button labeled `Export AMI Report` is disabled until at least one item is selected.

The main content is a tabbed workspace with five tabs:
- Product Candidates
- Promo Candidates
- Inventory Actions
- Supplier Comparison
- Evidence & Reasoning

The first three tabs use selectable list cards with checkboxes and `View details` links. The supplier tab displays a table of suppliers with checkboxes and details actions. The evidence tab uses expandable details blocks containing evidence links, evidence metadata, and assistant reasoning panels.

Drawers slide in from the right when an item or supplier detail is opened. The drawer covers the viewport with a dark translucent backdrop and shows a tall white panel with close controls.

### Main Buttons and Actions
| Button / Action | Location | Visual Priority | State(s) | Interaction | Destination / Result |
|---|---|---|---|---|---|
| Export AMI Report | Partner’s Choice panel | primary | default, disabled | click | placeholder message `Report export is not connected yet.` |
| Product/Promo/Inventory checkbox | tab lists | secondary | selected/unchecked | click | toggles selection sets |
| View details | row cards | low | default | click | open right-hand drawer |
| Select supplier checkbox | Supplier Comparison table | secondary | selected/unchecked | click | toggles supplier selection |
| See details | supplier table | low | default | click | open supplier drawer |
| Tab buttons | top of strategy section | navigation | active/inactive | click | switch content panel |

### UI States
| State | Where It Appears | Visual Behavior | Trigger | Notes |
|---|---|---|---|---|
| default | strategy page | tabs, cards, tables | normal load |
| selected | checkboxes | checked state and `selected` label in drawer | selecting rows or suppliers |
| warning | warning notice, amber badge | analysis warnings, data quality issues | analysis response has warnings |
| error | redirect fallback | missing analysis pushes to briefing | no cached/URL analysis |
| empty | tab content | message for no candidates or suppliers | no matching rows or no supplier options |
| connected | not applicable | n/a | n/a |
| not connected | evidence tab | source URL unavailable reason | fallback/demo evidence |
| fallback mode | evidence / source labels | `Fallback` or `Demo seed` copy | analysis source mode |
| export unavailable | Export AMI Report button | disabled and no action | no selected items |

### Interaction Flow
When the page loads, it fetches analysis by `runId` or falls back to localStorage. The top header sets the business goal and summary. Users can browse signal cards, switch tabs, select product/promo/inventory items, and optionally choose suppliers. Opening an item or supplier reveals a detailed drawer on the right. The export button stays disabled until at least one selection exists, and clicking it displays a placeholder message.

### Visual / UX Issues
- The screen is very tab-heavy and can feel overloaded for a single strategy page.
- Final recommendation summary is commented out, so the current screen lacks a strong top-level decision statement.
- Drawer interactions are rich, but the detail experience depends on inconsistent item mapping and selection state.
- No visible fallback or loading state is rendered when `analysis` is null; the component returns `null`, which may produce a blank screen briefly.
- The evidence tab has nested details toggles and dense technical metadata, increasing complexity.

---

## Screen: Assistant Overview

### Route and Files
- Route: `/assistant-overview`
- Files: `app/assistant-overview/page.tsx`, `components/assistants/AssistantOverviewClient.tsx`, `components/layout/PagePrimitives.tsx`, `components/ui/Badge.tsx`

### Visual Layout
The page begins with a `PageShell` and header containing a `Assistants` badge, page title, and description. Below is a vertical stack of assistant cards, one per assistant.

Each card has a border and subtle separation. Inside, the left block includes assistant name, role, latest contribution copy, and data sources used. The right block displays a status badge, run count, cost, and a credit limit progress bar with current usage. A small form allows changing the assistant credit limit.

If the assistant alert state is non-normal, an amber callout appears below the card with threshold copy.

### Main Buttons and Actions
| Button / Action | Location | Visual Priority | State(s) | Interaction | Destination / Result |
|---|---|---|---|---|---|
| Save credit limit | each assistant card | secondary | default | submit | `PATCH /api/assistant-usage`, updates usage state |

### UI States
| State | Where It Appears | Visual Behavior | Trigger | Notes |
|---|---|---|---|---|
| default | assistant cards | neutral bordered card | normal load |
| warning | badge and alert copy | amber badge, amber callout | `near_limit` state |
| exceeded | badge and progress | red badge, red progress | `exceeded` state |
| paused | badge and progress | red badge, red progress | `paused` state |
| 90% usage alert | implied by `near_limit` | amber styling | usage near limit |
| disabled | save button? | not shown | n/a | form submit remains enabled |
| loading | not explicitly shown | no spinner | n/a | there is no visible loading indicator for save action in markup |

### Interaction Flow
The page loads usage data and displays each assistant in order. Users can change the credit limit number and submit the form to update the assistant's monthly limit. After update, a message appears confirming the change.

### Visual / UX Issues
- Credit limit controls are present but the input/submit pairing may not feel clearly associated with each assistant card.
- There is no explicit `loading` or `saving` state for the save button, so state changes rely on the user trusting the action.
- The page is functional, but it is more operations-focused than advisory.

---

## Screen: Account Workspace

### Route and Files
- Route: `/account-workspace`
- Files: `app/account-workspace/page.tsx`, `components/workspace/AccountWorkspaceClient.tsx`, `components/layout/PagePrimitives.tsx`, `components/ui/Badge.tsx`

### Visual Layout
This page is the densest in the app. It begins with a `PageShell` and header `Control Hub` plus a message bar for status feedback.

It contains multiple large expandable `details` sections that are open by default:
- Personal Information
- Marketplace Setup

Under `Marketplace Setup`, there are four panel cards:
- User profile
- Linked services
- Payment method
- Demo credits

Then a large `Inventory context` panel appears with sync status, marketplace details, and a form for connection type. The inventory form includes a connection type select, credential entry, file upload, and action buttons.

Below that are two additional panels:
- Saved reports
- Approved recommendation history

Finally, a small section reiterates security/cautionary copy.

The page has high density with many grouped blocks. It feels like a management dashboard more than an MVP control panel.

### Main Buttons and Actions
| Button / Action | Location | Visual Priority | State(s) | Interaction | Destination / Result |
|---|---|---|---|---|---|
| Connect Inventory Source | inventory form | primary | default, loading | submit | `POST /api/inventory/connect`, load workspace state |
| Re-sync Inventory | inventory form | secondary | default, loading | click | `POST /api/inventory/sync`, update status |
| Remove Inventory Source | inventory form | secondary | default, loading | click | `DELETE /api/inventory/connect`, reset inventory state |
| Download CSV template | inventory upload panel | low | default | click | download file |
| Download JSON template | inventory upload panel | low | default | click | download file |
| Edit payment method | payment panel | low | default | click | toggle mock payment edit fields |
| Remove payment method | payment panel | low | default | click | mock remove payment method locally |

### UI States
| State | Where It Appears | Visual Behavior | Trigger | Notes |
|---|---|---|---|---|
| default | panels | white cards with border | normal load |
| connected | inventory status | green/teal badge | workspace snapshot connected |
| not connected | inventory status | neutral badge/text | no inventory source |
| sync running | inventory status | blue status label | sync request | re-sync button text changes |
| sync complete | inventory status | status updates from API | success |
| warning | inventory panel | amber notice | inventory warning state |
| error | inventory panel | red notice | inventory error state |
| demo mode | payment panel | amber copy | mock payment demo mode |
| fallback mode | not explicit | n/a | n/a | page does not show fallback-specific badge |
| empty | saved reports / history | gray placeholder card | no items |
| disabled | form actions | disabled attribute | busy state |

### Interaction Flow
Users can view workspace and marketplace details, manage inventory connection types, upload files, and connect or sync inventory. The inventory panel also allows removal of the current source. Payment controls are mock-only and toggle local state rather than real billing.

### Visual / UX Issues
- The page is too broad for an MVP and reads like a full workspace management system.
- Payment method mock UI adds noise and distracts from essential inventory controls.
- Inventory connection options are many and may overwhelm users; the page feels more like a technical admin screen.
- The `saved reports` and `approved recommendation history` sections are placeholders and contribute to the impression of a full product rather than a minimal flow.

---

## 3. Component Visual Inventory

| Component | File | Used In | Visual Role | States | Notes |
|---|---|---|---|---|---|
| AppShell | `components/layout/AppShell.tsx` | all route pages | shared header and navigation container | public home vs internal nav | also handles logout behavior |
| HomeTopNav | `components/layout/AppShell.tsx` | `/` | top public header | default | contains anchor links and Bright Data pill |
| navigation/header | `components/layout/AppShell.tsx` | internal pages | internal app nav and logout | active/inactive | responsive menu on mobile |
| PageShell | `components/layout/PagePrimitives.tsx` | market, recommendations, assistants, workspace | page wrapper | default | consistent main page padding |
| PageHeader | `components/layout/PagePrimitives.tsx` | several screens | title + description header | default | builds page hierarchy |
| Surface | `components/layout/PagePrimitives.tsx` | many cards | card layout | default | white card with border/shadow |
| StatusStrip | `components/layout/PagePrimitives.tsx` | `MarketContextClient` | status row | default | grey background strip |
| Badge | `components/ui/Badge.tsx` | many screens | status label / tag | neutral/teal/amber/red/green/blue | consistent color-coded chips |
| BrightDataPill | `components/ui/BrightDataPill.tsx` | multiple screens | brand accent | default | small pill label |
| StatusDot | `components/ui/StatusDot.tsx` | processing assistant rows | tiny status indicator | teal/amber/red/green | simple state dot |
| Form fields | components | forms across app | input controls | default/required | standard text input styling |
| Tabs | `RecommendationsClient.tsx` | recommendations screen | content navigation | active/inactive | five-tab layout |
| Drawers | `RecommendationsClient.tsx` | recommendation details | sliding detail panel | open/closed | dense detail content |
| Tables | `RecommendationsClient.tsx`, `AccountWorkspaceClient.tsx` | supplier table, history | data display | default | standard responsive tables |
| Alerts / callouts | various | warning/error messages | alert panels | warning/error/info | amber/red/teal styling |
| Progress indicator | `ProcessingClient.tsx` | processing screen | progress bar | dynamic | linear progress percentage |
| Credit usage controls | `AssistantOverviewClient.tsx` | assistant cards | limit editing | default | numerical input + save button |
| Inventory connection panels | `AccountWorkspaceClient.tsx` | workspace | connection management | default/connected/syncing/error | complex multi-mode form |

## 4. Navigation Visual Audit

- Public home nav: a compact header with `BrightDataPill` and links to `How it works?`, `Pricing`, and `New Workspace`.
- Internal app nav: a sticky header with `Briefing`, `AMI Strategy`, `Assistants`, `Control Hub`, and a `Log out` button.
- Active states: active internal links are styled with teal border and background, while inactive items remain gray.
- Mobile behavior: internal navigation collapses into a `details` menu on small screens. The logout action is included in the same menu.
- Logout placement: internal nav places logout alongside route links, which is a standard enterprise pattern.
- Bright Data visibility: the `Powered by Bright Data` pill appears in multiple screens, reinforcing the data provider brand.
- Anchors: `#how-it-works` and `#pricing` are present in the public home header, but corresponding content sections are absent in the current home screen.
- Nav labels: `Briefing`, `AMI Strategy`, `Assistants`, `Control Hub` map well to the intended architecture, though `Control Hub` is broad and may appear too generic.

Flagged labels:
- `Control Hub` is a strong label, but the content feels like both admin and workspace settings.
- `AMI Strategy` is appropriate, though the screen may need a clearer top-level recommendation summary to match the label.

## 5. AMI Recommendations Visual Audit

The `/recommendations` screen is the most visually complex page and mixes advisory layout with detailed technical panels.

### Strategy header
- A high-level header with a teal badge, business-goal title, last analysis metadata, source mode, and a `BrightDataPill`.
- This section is visually prominent and sets the strategy context.

### Business goal and metadata
- The business goal title is large and clear.
- Metadata appears as small text rows below the title, including analysis timestamp and source mode.
- Key counts for product/promo/inventory items appear in a compact info card group.

### Assistant findings
- Rendered as stacked signal cards with risk badge and assistant name.
- Each card is separated by pale borders and has a clear label hierarchy.
- This section reads as a signal summary rather than a decision-driving outcome.

### Tabs structure
- Five tabs are rendered horizontally, with active tab underlined in teal.
- Tabs are visually separated by border-bottom styling.
- The content area below changes depending on tab selection.

### Tab content separation
- Product, Promo, Inventory tabs use list cards with checkboxes and `View details` actions.
- Supplier Comparison uses a table and a checkbox column.
- Evidence & Reasoning uses expandable details blocks and dense text content.
- Each tab is visually distinct, but the number of tabs makes the page feel multi-tool.

### Partner’s Choice selection
- A pale result panel with a summary line and export button.
- Export button is disabled until selections are made.
- The panel uses secondary emphasis text and lighter background.

### Export placeholder behavior
- `Export AMI Report` is a white button when enabled and disabled otherwise.
- Clicking it after selection shows a placeholder message; there is no functional export yet.

### Drawers
- Drawers open from the right over a dimmed backdrop.
- They contain tall detail panels with multiple expandable sections and metadata fields.
- Close buttons are top-right and keyboard `Escape` is supported.

### Missing/missing-data behavior
- If analysis data is missing, the component returns `null` silently; the screen would likely appear blank.
- There is no explicit loading spinner or skeleton state in the component.

### Recommended hierarchy evaluation
The page does not clearly follow the ideal decision hierarchy because:
1. Final recommendation is commented out and not surfaced.
2. Why it matters exists inside drawer detail rather than as a page-first summary.
3. Confidence and risk appear in badges and metadata but are not strongly front-loaded.
4. Assistant contribution is presented as signal cards and drawer summaries.
5. Data quality notices appear, but they are secondary and conditional.
6. Evidence is available only in the Evidence tab and drawers, not as a top-level prioritized layer.

The screen therefore feels too technical and tab-heavy for a clean advisor flow.

---

## 6. Control Hub Visual Audit

This page is expansive and includes many management elements that exceed a minimal workspace panel.

### Personal information section
- Uses a `details` block and panel cards.
- Displays user name, email, workspace role, linked services, and payment mock info.

### Linked Bright Data service status
- Shown in a `Linked services` panel.
- Status is displayed as simple text and a `formatStatus` label.

### Mock payment method area
- Contains a yellow mock warning callout and payment details.
- Action buttons to edit or remove the payment mock.
- This area is clearly labeled as future-ready and not active.

### Demo credits
- Panel shows available credits, credits used, monthly limit, and reset date.
- A progress bar visualizes usage.

### Marketplace profile
- Lists workspace and business profile details in a panel.
- Uses simple `Fact` cards.

### Inventory context
- The densest panel. It includes sync status, connection label, last sync timestamp, warning/error notices, and a full form for connection type.
- Connection mode select and credential fields are visible.
- CSV/JSON upload optionally shows file chooser and demo template download links.
- There are buttons for connect, re-sync, and remove.

### Saved reports
- A placeholder panel with empty state copy.

### Approved recommendation history
- A panel with placeholder cards or actual recommendation rows.

### MVP evaluation
This page feels too broad for MVP. It crosses into:
- inventory management
- payment mock management
- profile/dashboard history
- admin settings

For MVP, the page should probably stay lightweight and focused on:
1. Connect Inventory Sources
2. Check Inventory Sync Status
3. View Approved Recommendation History

The current design adds complexity with payment mock controls, editable workspace profile, and multiple connection modes.

### Issue flags
- The `Control Hub` page feels like a full inventory and admin system rather than a simple workspace control panel.
- Payment method mock details dilute the core inventory/recommendation controls.
- The strong emphasis on file uploads and connection modes makes the page feel heavy.

---

## 7. Assistant Overview Visual Audit

This page is concise and focused on the four assistants.

### Assistant presence
The code renders four assistants from `VisibleAssistants`: likely `orchestrator`, `inventory`, `trend`, `competitor`, and `supplier`. The actual page content shows each assistant edition in the same pattern, though the label list is derived from the data list.

### Visual structure
- Each assistant is a card with a title, role, latest contribution, and data source summary.
- On the right, there is a badge for alert state, run count, cost, and a credit progress bar.
- The credit limit input is a numeric field with a save button.
- Non-normal alert states show an amber callout.

### Usage count and credit limit
- `Runs` and `Cost` are displayed as small usage facts.
- The progress bar is horizontal and colored by alert state.
- The input field for credit limit is inline and uses a submit form.

### Alerts and limits
- `near_limit` appears as amber, `exceeded` or `paused` appear as red.
- The page includes textual threshold guidance.

### Issues
- The save control is visually present but the `Save` button is small and not clearly separated from the rest of the card.
- There is no explicit `loading` or `saving` indicator on submit.
- If the user does not know what `creditsUsed` means, the card may feel too operational.

---

## 8. Visual Style Alignment

| Area | Current Visual Behavior | Target Fit | Issue | Suggested Direction |
|---|---|---|---|---|
| Overall palette | light surfaces, teal accents, amber warning | good | fits enterprise SaaS | continue with white/teal and subtle depth |
| Header/nav | sticky internal header, public nav links | good | public anchors do not resolve | remove or implement target sections |
| Card system | white panels with border/shadow | good | consistent across app | maintain reuse |
| Recommendations page | dense tabs and drawers | medium | too technical, lacking strong advisor lead | surface top recommendation summary first |
| Control Hub | broad admin layout | poor | feels beyond MVP | simplify to inventory status and history only |
| Assistant overview | card-based, clear status | good | action controls need clearer affordance | emphasize save state feedback |
| Processing page | monitoring-style workflow | good | may feel like an engineering monitor | preserve but simplify copy for business users |
| Evidence UI | detailed metadata panels | medium | technical and dense | reserve full detail for expandable sections only |

---

## 9. Copy and Tone Snapshot

| Location | Current Copy | Issue | Suggested Direction |
|---|---|---|---|---|
| Home hero | `AMI reviews marketplace context, social trends, inventory status...` | heavy and marketing-like | simplify to advisor benefit statements |
| Market context button | `Start AMI Analysis` | clear | good | keep consistent |
| Processing status | `AMI is coordinating assistants` | functional | okay | maybe make more business-outcome focused |
| Recommendations header | `AMI Strategy` | good | keep advisor tone |
| Evidence tab | `Source evidence`, `Assistant reasoning and technical details` | technical | too data-science-heavy | use user-friendly terms like `Evidence & rationale` |
| Workspace payment panel | `Real payment processing is not active in this MVP.` | clear, but adds noise | could be hidden behind info icon |
| Inventory panel | `Inventory context connected` | clear | good | keep simple |

---

## 10. Missing Visual States

| Missing State | Area | Why It Matters | Suggested Direction |
|---|---|---|---|
| loading | `/recommendations` | avoids blank screen on analysis fetch | add spinner or skeleton state |
| no analysis found | `/recommendations` | prevents blank page if localStorage missing | show explicit message and button to return to briefing |
| export unavailable | `/recommendations` | clarifies disabled export | add tooltip or disabled helper text |
| sync failed | `/account-workspace` | needed for inventory troubleshooting | show explicit red error panel with retry |
| credit save pending | `/assistant-overview` | improves save feedback | show saving spinner or disabled state |
| fallback data | evidence panels | better sets expectation | show badge/pill for fallback/demo evidence |
| partial source | evidence sections | clarifies data quality | display partial source note prominently |
| unsupported backend feature | inventory control hub | avoids confusion | hide options when backend not supported |
| empty recommendation list | `/recommendations` | required for sparse analyses | show guided empty state with next step |

---

## 11. Priority Visual Fix List

| Priority | Issue | Area | Why It Matters | Suggested Direction |
|---|---|---|---|---|
| P0 | blank screen when analysis missing | `/recommendations` | blocks user understanding | add fallback page/message and redirect option |
| P1 | missing home section anchors | `/` | nav confusion | remove stale links or add sections |
| P1 | overly broad `/account-workspace` | Control Hub | dilutes MVP focus | reduce to inventory + history essentials |
| P1 | absent final recommendation summary | `/recommendations` | advisor outcome unclear | restore high-level recommendation block |
| P2 | no save/loading UI on assistant credit form | `/assistant-overview` | unclear feedback | add visual saving state |
| P2 | technical evidence copy | `/recommendations` | feels too dashboard-like | simplify labels and keep deep detail collapsible |
| P2 | many inventory connection modes | `/account-workspace` | overwhelms user | prioritize one or two supported flows |
| P3 | long registration form | `/` | onboarding friction | split into progressive steps |
| P3 | repeated detail panels | multiple pages | page density | collapse secondary panels by default |

---

## 12. Claude Review Notes

### What Claude Should Focus On
- whether `/recommendations` feels advisor-led or too much like a technical dashboard
- whether the navigation hierarchy matches AMI’s intended guided workflow
- whether the `Control Hub` page should be trimmed for MVP clarity
- whether the current use of tabs, drawers, and dense panels supports or impedes decision-making
- whether the public home page should expose non-existent anchor sections
- whether the assistant overview credit controls are visible enough and clearly actionable
- whether evidence detail should be nested deeper rather than surfaced by default
- whether warning and fallback states are visually distinct and user-friendly
- whether the current palette and card system align with a light enterprise SaaS advisor UX

### Questions for Claude
1. Does `/recommendations` present a clear primary recommendation hierarchy or is it too tab-driven?
2. Should the strategy page put final recommendation and confidence badges above the tabs?
3. Is the current `Control Hub` layout too broad for an MVP workspace page?
4. Are the inventory connection controls in `/account-workspace` too operational for the product’s first release?
5. Does the public home nav need the `How it works?` and `Pricing` anchors removed?
6. Is the assistant credit limit form visually clear and easy enough to use?
7. Does the processing page feel like a user-facing workflow or a developer monitor?
8. Should evidence and source details be moved deeper into a nested panel rather than the main tab structure?
9. Does the current palette and spacing feel like a light enterprise advisor product?
10. Are amber and red states used appropriately, or do they blend with normal status messaging?
11. Is the `Export AMI Report` placeholder flow acceptable, or should it be hidden until implemented?
12. Does the page-level hierarchy overall support guided decision-making or is it too fragmented?

---

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
- `components/ui/Badge.tsx`
- `components/ui/BrightDataPill.tsx`
- `components/ui/StatusDot.tsx`

## Routes inspected
- `/`
- `/market-context-setup`
- `/processing`
- `/recommendations`
- `/assistant-overview`
- `/account-workspace`

## Components inspected
- `AppShell`
- `HomeTopNav`
- `PageShell`
- `PageHeader`
- `Surface`
- `StatusStrip`
- `Badge`
- `BrightDataPill`
- `StatusDot`
- form fields
- tabs
- drawers
- tables
- progress indicators

## Assumptions made
- Visual appearance is inferred from Tailwind class names and component structure.
- No runtime screenshot or live browser render was available.
- Responsive behavior is derived from class names like `sm:`, `lg:`, and `details` menu patterns.
- The assistant list in `/assistant-overview` is assumed to represent all four AMI assistants via `VisibleAssistants`.

## Areas that could not be verified
- exact font sizes, spacing in rendered pixels, and color contrast
- actual mobile device appearance beyond responsive class intent
- precise drawer animation and overlay transition behavior
- whether the public home page currently contains hidden `#how-it-works` and `#pricing` sections outside inspected files
- actual API-driven state content and runtime behavior for analysis and inventory sync
