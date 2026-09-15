# Architecture

## 1. Constraints that shape everything

1. **Static hosting (GitHub Pages).** No server, no SSR, no database. All logic, storage and routing are client-side. The app is a JAMstack SPA.
2. **Venue reality.** Conference Wi-Fi is saturated and cell networks jam. The app must be fully functional with the network off, and must not lose a keystroke when it drops mid-show.
3. **Show-caller latency.** A producer advancing cues by the second cannot wait on a spinner. Local-first: every read and write hits local storage, never the network.
4. **Multi-surface, same machine.** Registration desk laptops run several tabs; a producer runs the grid on one screen and the timer on another. Cross-tab consistency is a correctness requirement, not a nicety.

## 2. Stack

| Concern | Choice | Why |
| --- | --- | --- |
| Build | **Vite 6 + TypeScript (strict)** | Fast HMR, first-class static output, trivial GitHub Pages base-path config |
| UI | **React 19** | Ecosystem for the specific libraries below; concurrent rendering helps the dense grids |
| Styling | **Tailwind CSS v4 + shadcn/ui (Radix)** | Copied-in components we own and restyle; semantic tokens make dark mode and per-event theming a variable swap |
| State | **Zustand** with `immer` + `persist` + `subscribeWithSelector` | Slice pattern; no provider tree; selector-level subscriptions avoid whole-tree re-renders in the 5k-row table |
| Durable data | **Dexie (IndexedDB)** | Async, quota in the hundreds of MB, stores blobs (cover art, badge assets) and large guest lists; versioned migrations |
| Collaboration | **Yjs** + `y-indexeddb` + `y-broadcastchannel` | CRDT merge for the rundown; offline edits reconcile without conflict UI |
| Tables | **TanStack Table + TanStack Virtual** | Headless — styles stay shadcn; virtualization is the only way to hit the perf budget |
| Drag & drop | **dnd-kit** (seating, cue reorder), **react-grid-layout** (dashboard) | dnd-kit is accessible and keyboard-operable; RGL is the industry answer for resizable widget grids |
| Charts | **Recharts** via the shadcn `Chart` wrapper | Token-driven colors flip with the theme, no conditional classnames |
| Forms | **react-hook-form + Zod** | Zod schemas are generated from custom-field definitions at runtime |
| Routing | **React Router 7** (data router) | Deep links, nested layouts, route-level code splitting |
| PWA | **vite-plugin-pwa** (Workbox) | Precached app shell, update prompt, offline navigation fallback |
| Dates | **date-fns** + `Temporal` polyfill only if needed | Rundown math is duration arithmetic; keep it explicit |
| Tests | **Vitest + Testing Library + Playwright** | Unit for engines, component for interactions, E2E for offline/multi-tab |

Deliberately excluded: Redux (verbosity), React Context for app state (re-render cost), Next.js (SSR is unusable on Pages), any component kit we cannot restyle.

## 3. State architecture — slice pattern

One bound store, composed from domain slices. Each slice owns its actions and nothing else touches its shape.

```ts
// src/store/index.ts
export type AppStore =
  & WorkspaceSlice   // workspaces, events, templates, active event id
  & GuestSlice       // guests, tiers, saved views, filters, selection
  & RundownSlice     // cue ordering, timing derivation, caller position (Yjs-backed)
  & SeatingSlice     // maps, zones, tables, seat→guest assignments, rules
  & CheckinSlice     // scan queue, arrivals, duplicate guards
  & TelemetrySlice   // simulated sensor feeds, thresholds, alerts
  & SchemaSlice      // custom field defs, statuses, tiers, metric configs
  & UiSlice;         // theme, sidebar, drawers, dashboard layout, toasts

export const useStore = create<AppStore>()(
  persist(
    immer((...a) => ({
      ...createWorkspaceSlice(...a),
      ...createGuestSlice(...a),
      /* ... */
    })),
    {
      name: 'atelier',
      // Only small, boring preferences persist here; every domain record
      // lives in IndexedDB (data/db.ts), not in the store.
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ scheme: s.scheme, sidebarCollapsed: s.sidebarCollapsed, activeEventId: s.activeEventId }),
      version: SCHEMA_VERSION,
      migrate: migrateStore,
    },
  ),
);
```

Rules:

- **`immer` for nested writes.** Moving a guest between seats or re-ordering a cue is written as a mutation and stays immutable underneath.
- **`partialize` is explicit.** UI transients (open drawers, hovered row, crossfades) are never persisted. Domain data is not persisted through Zustand at all — it lives in Dexie and the store holds the working set, so the persisted blob stays a few hundred bytes of preferences.
- **Selectors, not whole-store subscriptions.** Components subscribe with `useStore(s => s.guests.byId[id])`; the guest table subscribes to ids only and rows subscribe individually.
- **Derived values are computed, not stored.** Cue start times, MIV scores, and room capacity are pure functions of state, memoized — never duplicated into state where they can drift.

## 4. Data flow

```
 UI action
   │
   ├─▶ Zustand action (immer)  ──▶ optimistic render (instant)
   │
   ├─▶ Dexie write (async)     ──▶ durable
   │
   ├─▶ syncBus.post(event)     ──▶ other tabs update their stores
   │
   └─▶ mutationQueue.enqueue() ──▶ (only if a SyncProvider is configured)
                                    replayed on reconnect via Background Sync
```

`syncBus` wraps `BroadcastChannel` with a `localStorage`-polling fallback for browsers that mishandle it, exposing `post(event)` / `subscribe(handler)` and nothing else. One module, one place to fix Safari.

## 5. Offline-first and the PWA

- **App shell precached** at service-worker install: HTML, JS, CSS, fonts, icons. Navigation is served cache-first, so a cold offline load still boots.
- **Stale-while-revalidate** for anything fetched (template gallery, docs) — paint from cache, refresh in the background.
- **Offline is a first-class state, not an error.** A persistent status chip shows `Online · Offline · Syncing (n queued)`. No destructive action is blocked by being offline.
- **Update flow:** a new deployment surfaces a non-blocking "New version ready — reload" toast. Never auto-reload: reloading mid-show is unacceptable.
- **Storage durability:** `navigator.storage.persist()` requested on first meaningful write; `navigator.storage.estimate()` drives a storage-health indicator in Settings and warns before quota.

## 6. Cross-tab consistency

Two mechanisms, chosen by data type:

| Data | Mechanism | Rationale |
| --- | --- | --- |
| Guest check-ins, seat assignments, settings | `syncBus` (BroadcastChannel) + Dexie as truth | Last-write-wins is correct here; writes are small and rarely concurrent on the same record |
| Rundown document | **Yjs CRDT** | Multiple producers legitimately edit the same sheet at once, offline, and must merge without loss |

The check-in path also carries a **duplicate guard**: arrivals are keyed by `guestId`, and a second scan reads Dexie (not the in-memory store) before writing, so two desks scanning the same badge simultaneously produce one arrival and one "already checked in" warning.

## 7. The rundown CRDT

```
Y.Doc
 └─ Y.Array<Y.Map> 'cues'        // ordered cue rows; Y.Array gives conflict-free reordering
     └─ Y.Map fields             // title, durationSec, anchor, notes, per-department cells
 └─ Y.Map 'meta'                 // showStart, columns[], callerCueId
 └─ Y.Text 'prompter:<cueId>'    // script bodies — character-level merge
```

Providers: `y-indexeddb` (durability + instant reload), `y-broadcastchannel` (cross-tab), and an optional `y-websocket`/`y-webrtc` provider for cross-device demos. Yjs awareness carries the show-caller position and each user's cursor, which is exactly the "Show Caller Tracking" behaviour Shoflo is known for.

**Timing is derived, never stored.** Cue start times are computed from `showStart` + preceding durations, with **anchors** (a cue pinned to a wall-clock time) absorbing drift. So a duration edit is a one-field CRDT update and the cascade is a pure recomputation — no write amplification, no merge conflicts over derived data.

## 8. Folder structure

```
src/
  app/                  routes, layouts, router config, error boundaries
  modules/
    workspace/          event CRUD, templates, cockpit
    guests/             table, detail sheet, import wizard
    rundown/            grid, timing engine, caller, prompter, timer
    seating/            canvas, shapes, rules engine
    checkin/            kiosk, scanner, queue
    command/            widget registry, grid, telemetry
    metrics/            MIV/EMV engines, formula parser, recap
    studio/             schema editor, brand tokens, module toggles
  components/ui/        shadcn primitives (owned, restyled)
  components/           shared composites (DataTable, EmptyState, ThemeCrossfade…)
  store/                slices + composition + migrations
  data/
    db.ts               Dexie schema + versioned migrations
    seed/               deterministic demo generators + fixtures
    io/                 CSV/JSON/ICS import + export
  lib/
    syncBus.ts  time.ts  formula.ts  rng.ts  a11y.ts  perf.ts
  styles/               tokens.css, themes/
tests/
  unit/  component/  e2e/
docs/                   these specifications
```

Module boundaries are enforced: a module may import from `components/`, `lib/`, `store/`, and `data/` — never from another module's internals. Cross-module needs go through the store or a shared component.

## 9. Optional sync adapter

v1 ships local-only, but the seam exists from P0 so adding a backend is configuration, not surgery:

```ts
export interface SyncProvider {
  push(mutations: Mutation[]): Promise<void>;
  pull(since: Cursor): Promise<Mutation[]>;
  subscribe(onRemote: (m: Mutation[]) => void): Unsubscribe;
  status(): SyncStatus;
}
```

`LocalOnlyProvider` (default) resolves immediately and keeps the queue drained. A future `SupabaseProvider` implements the same four methods; the mutation queue, optimistic UI, and offline banner are already built around it. Documented, not built.

## 10. Performance strategy

| Budget | How it is met |
| --- | --- |
| Shell < 250KB gz | Route-level code splitting; Recharts, dnd-kit, react-grid-layout and the scanner lazy-load with their routes |
| 5,000-row table at 60fps | TanStack Virtual; row components subscribe to their own record only; column visibility from saved views trims work |
| 500-cue recompute < 16ms | Timing is a single O(n) pass over a typed array of durations, memoized on `[showStart, durations, anchors]` |
| 400-seat canvas drag at 60fps | Transform-only drag (no layout), `will-change`, pointer events on a single canvas layer, commit to state on drop |
| Cold start < 2s | Precached shell, seed data loaded lazily and in a worker, fonts self-hosted with `font-display: swap` |

Guarded by a Playwright performance test that fails CI if the seeded 5,000-guest table drops frames on scroll or the bundle exceeds budget.
