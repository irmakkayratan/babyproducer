# Atelier — Event Production OS

A web-based event production OS for culture-driven events: fashion shows, brand activations, product launches, pop-ups and conferences.

It merges the tools this industry runs in parallel — VIP guest management and media value (Launchmetrics), real-time cue sheets and show calling (Shoflo / Rundown Studio / Stagetimer), creator CRM (CreatorIQ), event logistics (Cvent / Bizzabo), and the two jobs that otherwise live in a mail thread and a spreadsheet: **advancing** a show and **settling** it — into one local-first web app that works offline in a venue, ships with a fully populated demo, and can be reshaped for any kind of event without writing code.

**Everything runs in your browser.** No server, no account, no analytics. Guest data — which is real PII when this is used for real — never leaves the device.

## Try it

```bash
npm install
npm run dev     # then open the URL it prints and click "Explore the demo"
```

The demo builds four complete productions locally in about a second: a Paris runway show, a four-day beauty pop-up, a corporate launch keynote and a touring date already played — guests, seating, cue stacks, advance sheets, arrivals, sensor telemetry and a settled box office. It is generated from a fixed seed, so **Reset** rebuilds it exactly, and **Copy to my workspace** forks it into one you own.

## What it does

| Module | What you get |
| --- | --- |
| **Guests & talent** | Virtualized list of thousands, vocabulary-driven filters, custom fields, CSV import with column mapping, detail sheet with a media-value breakdown |
| **Seating** | Room built to capacity, drag or keyboard assignment, tier colouring, rules that warn (keep-apart, seat-together, tier-in-zone, max-per-table) without blocking you |
| **Run of show** | Time-aware cue grid where a duration edit re-times everything below it, hard and soft anchors, show caller (space = next cue), stage timer and teleprompter on their own links, printable cue sheet |
| **Advancing** | Pre-production checklist with a readiness figure and a "still missing" panel, travelling parties with flights, hotels and transfers, production contacts, a chronological day sheet, printable advance sheet |
| **Check-in** | Typo-tolerant door search, QR scanning, duplicate guard across desks, walk-ins, locally generated badges, fully offline |
| **Command center** | Composable widget grid over live telemetry, layout saved per dashboard, threshold alerts |
| **Recap** | Post-event report: attendance funnel, arrival pattern, room composition, top contributors, planned-vs-actual timing, CSV export |
| **Settlement** | Box office by price band, off-the-top deductions, show costs, and deals (flat · percentage · guarantee vs percentage · guarantee plus bonus) resolved into payouts, a house P&L and a statement that prints to PDF |
| **Studio** | Vocabulary, custom fields, metric formulas and weights, brand tokens, module toggles, workspace import/export |

## How it is built

Vite · React · TypeScript (strict) · Tailwind v4 with semantic tokens · shadcn-style components owned in-repo · Zustand (slices + immer) · Dexie/IndexedDB · Yjs CRDT for the rundown · TanStack Virtual · react-grid-layout · Recharts · vite-plugin-pwa · Vitest + Playwright + axe · GitHub Actions → GitHub Pages.

Three ideas carry most of the weight:

1. **Local-first.** Every read and write hits IndexedDB. The network is never on the critical path, because venue Wi-Fi fails and the show does not.
2. **Derived, not stored.** Cue start times are computed from durations and anchors on every render; so is every figure on a settlement statement, from gross receipts to the balance due. That is what makes the drift cascade fast *and* makes the CRDT safe — there is no derived data to conflict over — and it is why a settlement re-run at 1am as the door count firms up cannot disagree with the numbers underneath it.
3. **Vocabulary is data.** No `Celebrity | Influencer | Media` union exists anywhere in the code. Tiers, voices, statuses, cue columns, metric formulas and weights are records the user edits, enforced by a lint rule that keeps industry words out of the app and in `data/templates.ts` and `data/seed/`.

## Scripts

```bash
npm run dev        # dev server
npm run build      # typecheck, build, write the SPA 404 fallback
npm test           # unit and component tests
npm run e2e        # Playwright, including offline, cross-tab and axe checks
npm run size       # bundle budget (eager shell must stay under 250KB gz)
npm run lint       # includes the domain-neutrality rule
```

## Documentation

| Document | Contents |
| --- | --- |
| [docs/PLAN.md](./docs/PLAN.md) | Scope, modules, roadmap, risks, decisions |
| [docs/architecture.md](./docs/architecture.md) | Stack, state, offline/PWA, CRDT, cross-tab sync, performance |
| [docs/data-model.md](./docs/data-model.md) | Entities, Dexie schema, custom fields, metric engine |
| [docs/modules.md](./docs/modules.md) | Per-module specs and acceptance criteria |
| [docs/design-system.md](./docs/design-system.md) | Tokens, theme crossfade, motion, accessibility, print |
| [docs/customization.md](./docs/customization.md) | The seven customization layers |
| [docs/demo-data.md](./docs/demo-data.md) | Scenarios, deterministic generation, tour, reset |
| [docs/testing-and-deployment.md](./docs/testing-and-deployment.md) | Test pyramid, CI/CD, GitHub Pages, browser matrix |

## Deploying

Push to `main` and the Pages workflow builds with `VITE_BASE=/<repo>/`, writes a `404.html` SPA fallback and deploys. For a custom domain, leave `VITE_BASE` unset.
