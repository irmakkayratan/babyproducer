# Testing, Quality & Deployment

## 1. Test pyramid

| Layer | Tool | What it covers |
| --- | --- | --- |
| **Unit** | Vitest | Timing engine (drift cascade, hard/soft anchors, DST boundaries), formula parser (including hostile inputs), the settlement engine (every deal shape, cascading deductions, rounding, half-filled sheets), advance readiness and checklist instantiation, custom-field → Zod generation, CSV mapping and coercion, seeded generators (determinism), seating rule predicates, Dexie migrations against prior-version fixtures, arrival reduction and duplicate guards |
| **Component** | Vitest + Testing Library | Table filtering/sorting/virtualization, guest sheet, import wizard, cue grid editing, seating keyboard path, kiosk scan states, widget settings forms, field renderers per kind |
| **Integration** | Vitest (jsdom + fake-indexeddb) | Store ↔ Dexie ↔ syncBus round trips; Yjs merge of two docs edited offline; optimistic update then failure rollback |
| **E2E** | Playwright (Chromium preinstalled) | The real proofs, below |
| **Performance** | Playwright + tracing | Bundle budget, 5,000-row scroll frame timing, 500-cue recompute, 400-seat drag |
| **Accessibility** | `@axe-core/playwright` | Every route in both themes; zero serious/critical violations |

## 2. The E2E proofs that matter

These are the claims the product makes, so they are tested end to end:

1. **Offline round trip**. Load, go offline, create an event, edit cues, check in guests, reload, verify nothing is lost, go online, verify the queue drains.
2. **Cross-tab check-in**, two browser contexts; check in on A; B reflects it under 200ms and refuses the duplicate.
3. **CRDT merge**, two contexts edit different cue rows while both offline; on reconnect both converge with no lost edits.
4. **Drift cascade**, change one duration in a 500-cue rundown; assert every downstream planned start and that a hard anchor absorbs the drift.
5. **Caller sync**. Advance the caller in the grid; the timer display and second tab follow within a frame; a producer message appears on the stage display.
6. **Customization loop**. Add a custom field in Studio, see it in table/detail/form/export; rename a voice; swap rundown columns; replace the metric; disable a module and confirm its routes are gone.
7. **Import/export fidelity**. Export a workspace, wipe storage, import, assert deep equality of schema, brand, views and data.
8. **Demo integrity**. Load demo, run Simulate Live at 60×, reset, assert the seed is byte-identical to the original.
9. **Install & cold start**. PWA installs; a cold offline load boots the shell and restores the last event.
10. **Advance readiness**. Confirm a required line from the missing panel and assert the readiness figure moves; add a party and assert the per-party questions repeat; assert an answer survives a reload.
11. **Settlement arithmetic**, change what sold and assert the balance due follows; raise a guarantee past the percentage and assert the statement names the side that applied; finalize and assert the sheet is read-only until reopened.

## 3. Definition of done (every phase)

- [ ] `tsc --noEmit` clean under `strict`
- [ ] ESLint clean (including the domain-vocabulary lint rule from [customization.md](./customization.md))
- [ ] Unit + component tests pass; new logic has tests
- [ ] Playwright suite green
- [ ] axe clean on touched routes, both themes
- [ ] Bundle budget respected
- [ ] Demo seed still generates and the affected surface shows real data
- [ ] Docs updated if behaviour or schema changed
- [ ] Deployed preview build verified in the browser

## 4. CI/CD

```yaml
# .github/workflows/ci.yml       : pull requests and pushes
jobs: typecheck · lint · unit · build (bundle budget) · e2e (Playwright, Chromium) · axe

# .github/workflows/deploy.yml   : push to the default branch
jobs: configure-pages → build (VITE_BASE from base_path) → verify → upload-pages-artifact → deploy-pages
```

**The repository must publish Pages from GitHub Actions, not from a branch.**
Branch publishing serves the repository tree as it is committed, so a visitor
receives the source `index.html`, whose only script tag points at
`/src/main.tsx`. No browser can run TypeScript, so the page stays blank and
nothing in the build output is ever reached. `configure-pages` runs with
`enablement: true` to correct the setting, and it has to run before the build
because the build reads the serving path from its `base_path` output. A
`verify` step then refuses to publish an artifact that is the source tree
rather than a build, because Pages reports that mistake as a successful
deployment.

Notes: builds are reproducible (lockfile committed, pinned Node), the Playwright job reuses the preinstalled Chromium, and each deploy stamps a build id and commit SHA into the app footer and the service worker so a stale cache is diagnosable.

## 5. GitHub Pages specifics

- **Base path.** Vite `base` comes from `VITE_BASE`, which the workflow fills from the `base_path` reported by `configure-pages`, so a project site (`/babyproducer/`), a user site and a custom domain all build correctly with no edit. `vite.config.ts` normalises the value, since `base_path` arrives without a trailing slash and Vite needs one at both ends.
- **SPA fallback.** `404.html` is a copy of `index.html` so deep links (`/w/demo/events/x/rundown`) resolve. The router uses history mode, no hash URLs.
- **Service worker scope** is the base path; `navigateFallback` points at the base `index.html`.
- **Headers.** Pages cannot set custom headers, so nothing is designed to depend on them (no COOP/COEP-gated APIs, no SharedArrayBuffer).
- **Assets** are fingerprinted and immutable-cached by the service worker, not by server headers.

## 6. Browser matrix

| Browser | Support | Notes |
| --- | --- | --- |
| Chrome / Edge 120+ | Full | `BarcodeDetector` native; Background Sync available |
| Safari 17+ (macOS/iOS) | Full with fallbacks | `@zxing/browser` for scanning; `syncBus` localStorage fallback; no Background Sync. Foreground queue drain instead |
| Firefox 120+ | Full with fallbacks | Same scanner and sync fallbacks |
| iPad / Android tablets | Primary onsite target | Kiosk mode tested at tablet breakpoints, touch-first |

## 7. Observability without a backend

- An in-app **Diagnostics** panel: storage estimate and persistence status, IndexedDB record counts, service-worker state and version, sync-queue depth, last error log (ring buffer, local only), and a one-click "download diagnostics bundle" for support.
- Global error boundary per route, so one broken widget never takes down the show. It renders a bounded error card with a retry.
- **No third-party analytics, no telemetry leaves the browser.** All event and guest data, which is real PII when the tool is used for real. Stays on the device. Say so plainly in the UI and the README.

## 8. Data safety

- Dexie migrations are versioned and tested against fixtures of the previous version.
- Destructive actions (reset, delete event, archive field, import-overwrite) prompt with a named scope and offer "Export a backup first".
- `navigator.storage.persist()` is requested on first meaningful write, with a visible warning if the browser declines.
- Automatic local snapshot of the active event to a Dexie history table before each risky operation, restorable from Diagnostics.
