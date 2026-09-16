# Atelier — Event Production OS
## Master Build Plan

> **Status:** Built. Phases P0–P8 are implemented, tested and deployed from this branch; this document remains the specification the code is measured against.
> **Working title:** *Atelier* (the product name is a single brand token — see [customization.md](./customization.md#1-brand--identity)).
> **Source of record:** `Event Production App Research` (industry analysis of Cvent, Bizzabo, Launchmetrics, Shoflo/LASSO, Rundown Studio, Stagetimer, CreatorIQ, and experiential/EMV-MIV practice).

---

## 1. What we are building

A **web-based event production operating system** for culture-driven events — fashion shows, brand activations, product launches, pop-ups, conferences — that unifies the four workflows the industry currently splits across four vendors:

| Industry tool | What it does well | What Atelier absorbs |
| --- | --- | --- |
| **Launchmetrics Events** | Curated VIP guest lists, visual seating, RFID/barcode check-in, media value | Guest & Talent CRM, seating builder, check-in, MIV scoring |
| **Shoflo / LASSO, Rundown Studio** | Real-time cue sheets, auto-drift timing, show-caller sync, teleprompter | Run of Show engine |
| **Stagetimer** | Stage-facing countdowns, producer→stage messaging | Timer & prompter display surfaces |
| **CreatorIQ** | Creator CRM, tiering, performance attribution | Talent profiles, voice tiers, campaign recap |
| **Cvent / Bizzabo** | Registration logic, onsite ops, dashboards | Event setup, registration forms, command center |

Three hard requirements from the brief drive every decision below:

1. **Fully usable on the web.** Runs entirely in the browser — no backend required, installable as a PWA, works offline in a venue with dead Wi-Fi.
2. **Demo test examples.** Ships with rich, deterministic, realistic sample data so anyone can open the URL and immediately use a fully populated production.
3. **Fully customizable to the user's use case.** Nothing about fashion, luxury, or beauty is hardcoded. Fields, statuses, tiers, rundown columns, metric formulas, dashboards, themes and enabled modules are all user-editable and portable. See [customization.md](./customization.md).

### Non-goals (v1)

- No server, no accounts, no multi-tenant auth (an optional sync adapter is designed for but not built — [architecture.md](./architecture.md#9-optional-sync-adapter)).
- No payment rails and no ticketing integrations. The settlement module computes and documents what is owed; moving money, and pulling box office reports from a ticketing provider, stay outside it. Contracts live wherever they already live — the advance tracks whether one is signed, not its text.
- No live social-API scraping. MIV/EMV are computed from data the user supplies or the demo seeds — the engine is real, the follower counts are not.
- No native iOS/Android build. The PWA covers onsite handhelds and kiosks.

---

## 2. Who it is for

| Persona | Primary surface | What "success" means to them |
| --- | --- | --- |
| **Producer / Head of Production** | Command Center, Run of Show | One screen that says whether the show is on time and who is in the room |
| **Show Caller / Stage Manager** | Show Caller mode, Timer display | Never miss a cue; push the room to the next beat with a keystroke |
| **Guest List / PR Manager** | Guest CRM, Seating | Curate, seat, and re-seat VIPs up to the minute doors open |
| **Front-of-house / Door staff** | Check-in kiosk (phone/tablet) | Scan, resolve, and check in fast, offline, without duplicates |
| **Brand / Client stakeholder** | Recap dashboard, shared views | See the value the event generated in numbers they trust |

---

## 3. Product surface map

```
/                         Landing → Explore demo · Start from template · Start blank
/w/:workspace             Workspace home (all events, calendar, templates)
  /events/:eventId
    /overview             Event cockpit: countdown, health, blockers, activity
    /guests               Guest & Talent CRM (table · board · saved views)
    /guests/:guestId      Detail sheet: profile, MIV/EMV radar, history, notes
    /seating              Seating chart builder (canvas, zones, rules)
    /rundown              Run of Show grid (CRDT, auto-drift, departments)
    /rundown/caller       Show Caller mode (full-screen, keyboard-first)
    /advancing            Advancing tracker (checklist, parties, day sheet, advance sheet)
    /checkin              Onsite check-in / kiosk mode (QR + search + walk-ins)
    /command              Experiential Command Center (resizable widget grid)
    /recap                Post-event report (attendance, MIV/EMV, dwell, export)
    /settlement           Settlement sheet (box office, costs, deals, payouts, PDF)
    /settings             Event-level: theme, fields, statuses, modules, sharing
  /studio                 Workspace-level customization (schema, metrics, brand, templates)
/show/:eventId/timer      Public stage display (countdown + producer messages)
/show/:eventId/prompter   Teleprompter surface (talent-facing)
```

Every route is deep-linkable, offline-capable, and printable where it matters (rundown, seating, badges).

---

## 4. Architecture in one paragraph

A **Vite + React + TypeScript SPA**, styled with **Tailwind + shadcn/ui** semantic tokens, state in **Zustand slices** (`immer` + `persist`), durable data in **IndexedDB via Dexie**, collaborative rundown state in a **Yjs CRDT** (`y-indexeddb` for durability, `BroadcastChannel` for cross-tab, optional WebRTC/WebSocket provider for cross-device), packaged as an offline-first **PWA** and deployed to **GitHub Pages** by GitHub Actions. All reads and writes are local and synchronous-feeling; the network is never on the critical path. Full detail: [architecture.md](./architecture.md).

---

## 5. Modules and what "done" means

Each module is specified with data model, interactions, and acceptance criteria in [modules.md](./modules.md). Summary:

| # | Module | Core capability | Headline acceptance criterion |
| --- | --- | --- | --- |
| M1 | **Workspace & Event shell** | Events, templates, theming, cover art, event cockpit | Create an event from a template in under 30s; theme change crossfades the whole shell |
| M2 | **Guest & Talent CRM** | Dense table, custom fields, saved views, CSV import, detail sheet, MIV radar | 5,000 guests scroll at 60fps; a CSV with unknown columns imports via a mapping wizard |
| M3 | **Run of Show** | Time-aware cue grid, auto-drift cascade, departments, anchors, caller mode, prompter | Editing one duration re-times 500 downstream cues in <16ms; two tabs edit different rows and merge with no loss |
| M4 | **Seating Chart** | Drag-drop canvas, zones/tables/rows, tier colors, adjacency rules, print | Move a VIP between seats with the mouse or keyboard; rule violations flag live |
| M5 | **Check-in / Kiosk** | QR scan, fuzzy search, plus-ones, walk-ins, offline queue, badge print | Check in with the network disabled; a second tab reflects it in <200ms and blocks a duplicate |
| M6 | **Command Center** | Resizable widget grid, simulated sensor telemetry, thresholds/alerts | Rearranged layout survives reload; widget registry is extensible without touching the grid |
| M7 | **Metrics & Recap** | MIV/EMV engines with editable weights, formula builder, export | Change a voice-authority weight and every score, chart and report updates consistently |
| M8 | **Studio (customization)** | Custom fields, statuses, tiers, rundown columns, brand tokens, module toggles, import/export | A user turns the fashion demo into a corporate keynote tool without writing code |
| M9 | **Advancing** | Pre-production checklist with readiness, parties, structured logistics, day sheet, printable advance sheet | What is still missing is answered before the checklist is; confirming a line moves readiness everywhere |
| M10 | **Settlement** | Box office, deductions, costs and deal terms resolved into payouts and a printable statement | Change one ticket count and every derived figure follows, on screen and in the PDF |

---

## 6. Demo experience

Detailed in [demo-data.md](./demo-data.md). In short: four complete, deterministic sample productions —

1. **"AURELIA — SS27 Runway"** — Paris fashion show. 420 guests across Celebrity/Influencer/Media/Buyer/Partner voices, front-row politics, RFID-style check-in, 68-cue rundown with music and lighting departments, seated in a 3-zone runway map.
2. **"LUMEN Beauty — Pop-Up Activation"** — 4-day retail activation. Foot-traffic telemetry, dwell time, LED volume and RFID trigger widgets, walk-in-heavy check-in, creator content log.
3. **"NOVA — Product Launch Keynote"** — corporate/tech tone. Proves the app is not fashion-only: theatre seating, speaker rehearsal blocks, teleprompter scripts, press embargo tracking.

Plus: a guided tour, a visible **Demo Mode** banner, one-click **Reset demo data**, **Fork demo into my workspace**, and **Simulate live** (a clock-driven simulator that runs the show, moves the caller, fires check-ins and pushes sensor data so the Command Center is alive on first open). All seeded from a fixed PRNG so screenshots and tests are reproducible.

---

## 7. Roadmap

Nine phases, each independently shippable and deployable. Effort is expressed in **build sessions** (one focused working block) rather than calendar dates.

| Phase | Name | Delivers | Effort |
| --- | --- | --- | --- |
| **P0** | Foundation | Vite/TS/Tailwind/shadcn scaffold, routing, theme tokens, Dexie schema v1, Zustand store skeleton, PWA shell, GitHub Actions → Pages, Vitest + Playwright smoke test | 2 |
| **P1** | Workspace & Events (M1) | Landing, workspace home, event creation from templates, Luma-style theming with crossfade, 1:1 cover art pipeline, event cockpit | 2 |
| **P2** | Guest & Talent CRM (M2) | Virtualized table, detail sheet, custom fields v1, saved views, CSV import wizard, optimistic check-in toggle + cross-tab broadcast | 3 |
| **P3** | Run of Show (M3) | Cue grid, auto-drift engine, anchors, department columns, Yjs CRDT, caller mode, timer + prompter displays | 3 |
| **P4** | Seating (M4) | Canvas builder, zones/tables/rows, drag-drop + keyboard seating, tier coloring, adjacency rules, print/PDF | 3 |
| **P5** | Onsite (M5) | Kiosk mode, QR generation + camera scanning, offline mutation queue, duplicate guards, badge printing | 2 |
| **P6** | Command Center + Metrics (M6, M7) | Widget registry, react-grid-layout, telemetry simulator, MIV/EMV engines, recap report + export | 3 |
| **P7** | Studio (M8) | Consolidated customization surface, schema editor, formula builder, brand tokens, module toggles, template authoring, JSON import/export | 3 |
| **P8** | Demo & polish | Three seeded productions, guided tour, demo banner with reset and fork, diagnostics, update prompt, a11y audit (WCAG 2.2 AA), perf budgets, docs | 3 |

**Total: ~24 build sessions.** P0→P3 already constitutes a genuinely useful product; P8 is what makes it demo-ready for a stranger with a link.

### Sequencing rules

- Every phase ends green: typecheck, lint, unit tests, Playwright smoke, and a deployed Pages build.
- Demo seed data for a module lands **with** that module, not in P8 — P8 enriches and ties it together.
- Customization is not a late phase bolt-on: custom fields land in P2, rundown columns in P3, metric weights in P6. P7 consolidates the surface rather than inventing the capability.

---

## 8. Quality bar

Full detail in [testing-and-deployment.md](./testing-and-deployment.md).

- **Performance budgets:** app shell < 250KB gzipped JS; time-to-interactive < 2s on a mid-tier laptop; 5,000-row guest table scrolls at 60fps; rundown recalculation of 500 cues under 16ms; seating canvas drag at 60fps with 400 seats.
- **Offline:** a full end-to-end Playwright run with the network blocked after first load — create, edit, check in, and reload without data loss.
- **Accessibility:** WCAG 2.2 AA. Keyboard path for every producer action including seating and cue advance; every Dialog/Sheet has an accessible title; `prefers-reduced-motion` respected by the theme crossfade and all transitions.
- **Determinism:** seeded data generates identically on every run so tests and screenshots are stable.
- **Data safety:** `navigator.storage.persist()` requested; export-before-destructive-action prompts; schema-versioned Dexie migrations; JSON export is the escape hatch from day one.

---

## 9. Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| CRDT complexity leaks into unrelated state | Bugs, slow dev | Yjs is scoped **only** to the rundown document; everything else is Dexie + Zustand. One clearly bounded integration. |
| IndexedDB eviction loses a live event's data | Severe | Request persistent storage on first write; auto-export snapshot to a downloadable file before risky ops; visible storage health indicator. |
| Static hosting means no real multi-device sync | Limits "real" use | Ship a `SyncProvider` interface with a local-only implementation; document the Supabase/y-websocket drop-in so it is a config change, not a rewrite. |
| Scope creep across eight modules | Never ships | Phase gates; each module has a written acceptance criterion; anything beyond it is logged, not built. |
| Safari quirks (BroadcastChannel, IndexedDB, camera) | Onsite failures | Abstract cross-tab behind one `syncBus` with a localStorage-polling fallback; feature-detect `BarcodeDetector` with a `@zxing/browser` fallback; document tested browser matrix. |
| Over-fitting to fashion | Fails "customizable" requirement | Fashion vocabulary lives entirely in seed data and templates; the code ships neutral defaults. Enforced by a test that boots a blank workspace and asserts no FLB-specific strings in the schema. |

---

## 10. Decisions I need from you

These do not block P0–P2; I will proceed on the default if you would rather I just build.

1. **Backend:** stay fully static/local-first (default, matches the research), or plan a Supabase-backed multi-device sync from P6 onward?
2. **Name:** keep *Atelier*, or another working title? (One token to change.)
3. **Demo scenarios:** the three above, or swap one for something closer to your actual work?
4. **Priority:** if you want value sooner, which module matters most — Run of Show, Guest CRM, or Seating? I will pull it forward.
5. **Visual direction:** dark-first editorial (default, per the research), light-first Luma-like, or both with a theme switch at first run?

---

## 11. Document index

| Document | Contents |
| --- | --- |
| [architecture.md](./architecture.md) | Stack, state management, offline/PWA, CRDT, sync, folder structure, performance |
| [data-model.md](./data-model.md) | Entities, TypeScript interfaces, Dexie schema, custom-field system, metric engine |
| [modules.md](./modules.md) | Per-module functional specs and acceptance criteria |
| [design-system.md](./design-system.md) | Tokens, Luma aesthetic, motion, component inventory, accessibility |
| [customization.md](./customization.md) | The seven customization layers and how a user reshapes the app |
| [demo-data.md](./demo-data.md) | Demo scenarios, seeding strategy, tour, simulator, reset |
| [testing-and-deployment.md](./testing-and-deployment.md) | Test pyramid, budgets, CI/CD, GitHub Pages specifics, browser matrix |
