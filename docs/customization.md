# Customization

> **Requirement:** "the user should be able to fully customize for their usecases."

The test this must pass: a corporate AV producer, a nonprofit gala planner and a Paris fashion house all open the same build and each ends up with a tool that looks purpose-built for them — **without writing code, and without a deploy**.

The way that is achieved is by keeping domain vocabulary out of the code entirely. Fashion terminology lives in seed data and templates; the codebase ships neutral primitives plus a registry for each extension point.

## The seven layers

### 1. Brand & identity
Workspace-level tokens: product name, logo (light/dark), favicon, accent color ramp, font pair, corner radius, default color scheme, landing copy. Applied through CSS variables, so every table, chart, canvas and print sheet follows immediately. *The app's own name is a token — "Atelier" is a default, not a constant.*

### 2. Schema — fields
Custom fields on Event, Guest, Company, Cue, Seat and Vendor. 16 field kinds including `select` with colored options, `relation`, `file` and `formula`. Per field: label, help text, required, default, and where it shows (table · detail · form · badge · print). Validation (Zod) and rendering (renderer registry) are generated from the definition, so a new field is fully functional everywhere the instant it is saved. Fields archive rather than delete, preserving historical data.

### 3. Vocabulary — statuses, tiers, voices, types
Every categorical axis is a user-editable list with label, color, order and semantics:

| Axis | Fashion default | Corporate example | Nonprofit example |
| --- | --- | --- | --- |
| Guest voice | Celebrity · Influencer · Media · Partner · Owned | Analyst · Press · Customer · Partner · Internal | Donor · Board · Beneficiary · Press |
| Guest tier | A-list · Front Row · Buyer · Press · Standing | Tier 1 · Tier 2 · General | Major gift · Sustaining · Guest |
| Guest status | Invited → Confirmed → Seated → Arrived → No-show | Registered → Checked in | Pledged → Attending → Attended |
| Cue item type | Walk · Music · Lighting · Finale | Slide · Demo · Q&A · Break | Speech · Auction lot · Video |
| Advance section | Schedule · Travel · Technical · Hospitality · Access | Schedule · Technical · Stream · Accreditation | Schedule · Catering · Auction · Paperwork |
| Party role | Headline · Support · Touring crew · Promoter | Principal · Crew · Vendor · House | Principal · Committee · Vendor |
| Expense category | Venue · Production · Staffing · Marketing · Travel | Venue · AV · Staffing · Stream | Venue · Catering · Print · Staffing |

Pipeline order defines the board columns and the funnel in the recap — change the statuses and every derived view follows.

### 4. Workflows — rundown columns, seating rules, advance checklists & deal terms
Department columns on the rundown are entirely user-defined (id, label, type, options, width, color, whether it prints). A broadcast team creates Camera/Graphics/VTR; a fashion house creates Music/Lighting/Model Order; a conference creates Slides/Mics/Stream. Seating rule sets (`seat-together`, `keep-apart`, `tier-in-zone`, `max-per-table`) are configured per event with `warn` or `block` severity. Check-in flow options: require QR, allow walk-ins, party handling, badge template, kiosk PIN.

The advance checklist is the same idea applied to pre-production: a template contributes entries on top of the neutral base, and every item is then editable, removable or addable per event — including which section it sits under, who owes it, when it is due and whether it repeats per travelling party. The settlement is configured the same way: price bands, deduction lines and cost lines are rows the user writes, each choosing its own basis (a fixed amount, a percentage of the box office or of the running balance, a rate per ticket or per head), and each party's deal picks one of four shapes against gross, adjusted gross or net.

### 5. Metrics — formulas & weights
MIV and EMV ship as editable `MetricConfig` presets, not hardcoded logic. Users edit weight tables (voice authority, platform CPM, content quality, tier multipliers), author additional metrics with the safe formula editor, choose formatting (currency/number/percent, decimals), pick which variables appear on the radar breakdown, and delete presets that do not apply to their world. Live preview against a real guest while editing; validation names the offending token.

### 6. Views & dashboards
Saved views per entity capture filters, sort, grouping, column order/visibility/width, density and view type (table/board), and can be shared workspace-wide, pinned to the sidebar, or set as the default landing view. Command Center dashboards are user-composed from the widget registry, with per-widget settings (source, metric, threshold, chart type, time window) and multiple named layouts per event.

### 7. Modules & templates
Modules (Guests, Seating, Rundown, Advancing, Check-in, Command Center, Metrics, Settlement) toggle on or off per workspace and per event; disabling one removes its nav, routes and cockpit tiles. **Event templates** bundle everything above — schema subset, statuses, rundown columns, seating map skeleton, dashboard layout, metric configs, and optional starter data — and are authorable by the user, exportable as JSON, and importable into any other browser or shared with a colleague.

Shipped templates: `Runway Show`, `Brand Activation / Pop-Up`, `Product Launch Keynote`, `Conference Track`, `Gala Dinner`, `Blank`.

## How the code enforces this

| Extension point | Mechanism |
| --- | --- |
| Field kinds | `FIELD_RENDERERS` registry (cell · detail · form control) + `fieldDefsToZod()` |
| Widgets | `WIDGET_REGISTRY` entries with `settingsSchema`; the grid never knows widget internals |
| Metrics | `MetricConfig` records evaluated by a whitelisted-grammar parser — no `eval`, no property access |
| Vocabulary | `SchemaConfig` lists; components resolve ids to labels/colors at render, never switch on literals |
| Themes | CSS custom properties written from `BrandTokens` and `ThemeOverride` |
| Modules | Route guards + nav derived from `enabledModules` / `moduleOverrides` |
| Templates | Pure data (`EventTemplate` JSON) applied by a single `applyTemplate()` function |

**Guardrail test.** A unit test boots a blank workspace and asserts the default schema contains no fashion-specific vocabulary, and a lint rule forbids literal domain strings (`'Celebrity'`, `'Front Row'`, …) outside `data/seed/` and `data/templates/`. This keeps "customizable" true as the code grows instead of decaying into hardcoded assumptions.

## Portability

Everything above is contained in a workspace JSON export: brand, schema, metrics, views, dashboards, templates, and optionally data. Import into a fresh browser and the app is identical. That export is simultaneously the backup story, the sharing story, and the migration path if a hosted backend is added later.
