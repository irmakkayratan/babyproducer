# Event-Production

**Atelier** — a web-based event production OS for culture-driven events: fashion shows, brand activations, product launches, pop-ups and conferences.

It merges the four tools this industry currently runs in parallel — VIP guest management and media value (Launchmetrics), real-time cue sheets and show calling (Shoflo / Rundown Studio / Stagetimer), creator CRM (CreatorIQ), and event logistics (Cvent / Bizzabo) — into one local-first web app that works offline in a venue, ships with a fully populated demo, and can be reshaped by the user for any kind of event without writing code.

## Status

📐 **Planning complete — awaiting approval to build.** No application code yet.

## The plan

Start here: **[docs/PLAN.md](./docs/PLAN.md)** — scope, modules, roadmap, risks, open decisions.

| Document | Contents |
| --- | --- |
| [docs/PLAN.md](./docs/PLAN.md) | Master plan: product, surfaces, roadmap (9 phases), quality bar, risks, decisions needed |
| [docs/architecture.md](./docs/architecture.md) | Stack, Zustand slices, IndexedDB, PWA/offline, Yjs CRDT, cross-tab sync, folder structure, perf |
| [docs/data-model.md](./docs/data-model.md) | Entities, TypeScript interfaces, Dexie schema, custom fields, MIV/EMV metric engine |
| [docs/modules.md](./docs/modules.md) | Eight module specs with acceptance criteria |
| [docs/design-system.md](./docs/design-system.md) | Tokens, Luma-style aesthetic, theme crossfade, motion, accessibility, print |
| [docs/customization.md](./docs/customization.md) | The seven customization layers and how the code enforces them |
| [docs/demo-data.md](./docs/demo-data.md) | Three seeded productions, deterministic generation, Simulate Live, guided tour |
| [docs/testing-and-deployment.md](./docs/testing-and-deployment.md) | Test pyramid, E2E proofs, CI/CD, GitHub Pages specifics, browser matrix |

## Planned stack

Vite · React · TypeScript (strict) · Tailwind + shadcn/ui · Zustand (slices + immer + persist) · Dexie/IndexedDB · Yjs CRDT · TanStack Table/Virtual · dnd-kit · react-grid-layout · Recharts · vite-plugin-pwa · Vitest + Playwright · GitHub Actions → GitHub Pages.

## Principles

- **Local-first.** Every read and write is local. The network is never on the critical path — venue Wi-Fi fails, the show does not.
- **Nothing hardcoded to one industry.** Fields, statuses, tiers, rundown columns, metric formulas, dashboards, themes and modules are all user-editable and exportable.
- **Demo-first.** Three complete, deterministic sample productions plus a live simulator, so the app is useful the second it loads.
- **Your data stays in your browser.** No backend, no analytics, no third-party requests.
