# Module Specifications

Each module lists functionality, the interaction design ("vibe"), the technical mechanism, and acceptance criteria that must pass before the phase is considered done.

---

## M1 · Workspace & Event Shell

**Functionality.** Landing page with three doors (Explore demo · Start from template · Start blank). Workspace home listing events as cover-art cards plus a calendar view. Event creation wizard: name, kind, date/time + timezone, venue, capacity, template, theme. Event cockpit showing countdown to doors, confirmed vs capacity, seating fill, rundown length and drift, open blockers, and a live activity feed.

**Design.** Luma-grade: full-bleed cover art, generous whitespace, editorial type, no dense chrome. Selecting a theme triggers a **full-screen crossfade** to the new dominant hue (a fixed-position gradient layer, opacity-animated over ~420ms, disabled under `prefers-reduced-motion`). Cover images enforce 1:1 at ≥800×800 via an in-browser crop tool, with corner-radius-safe guides so logos are not clipped.

**Technical.** Images resized and compressed client-side (`createImageBitmap` + canvas → WebP), stored as Blobs in Dexie. Theme is a set of CSS custom properties on `:root`; per-event themes override workspace brand tokens by scoping variables on the event layout element.

**Acceptance**
- [ ] Create an event from a template in under 30 seconds with three inputs.
- [ ] Theme change crossfades the entire shell including charts and tables, with no flash of unstyled color.
- [ ] A non-square 4000px upload is cropped, resized and stored under 300KB.
- [ ] Cockpit numbers are derived live from the other modules (no stored duplicates).
- [ ] Full keyboard path through the creation wizard.

---

## M2 · Guest & Talent CRM

**Functionality.** Dense virtualized table with column visibility/order/pinning, multi-sort, filter chips (tier, voice, status, tag, custom field), full-text search, grouping, bulk actions (assign tier, set status, add tag, seat, export, delete), inline editing, and **saved views** shared across the workspace. Board view grouped by status for RSVP pipeline work. Import wizard for CSV. Detail sheet per guest.

**Design.** The table is the product for this persona: shadcn `Table` primitives, 36px rows, tabular numerals, sticky header, tier shown as a colored dot plus label (never color alone). Clicking a row slides a **Sheet** from the right: procedurally generated avatar (deterministic gradient + initials via `AvatarFallback`), profile, audience stats, a **Recharts radar chart** of the metric breakdown (Reach · Authority · Content Quality · Engagement · Relevance), interaction history, seat, and notes. Keyboard: `j/k` to move, `Enter` to open, `c` to check in, `/` to search, `⌘K` for the command palette.

**Technical.** TanStack Table headless + TanStack Virtual. Rows subscribe to their own record. Check-in is **optimistic**: the button flips state immediately, the Dexie write follows, and a `syncBus` message updates every other tab in under 200ms — the Launchmetrics-iOS behaviour the research calls out. Metric scores compute lazily during virtualization and cache by input hash.

**Acceptance**
- [ ] 5,000 seeded guests scroll at 60fps; filtering returns in under 100ms.
- [ ] A CSV with arbitrary headers imports through the mapping wizard, with unknown columns optionally promoted to custom fields.
- [ ] A custom field added in Studio appears in table, detail, form and export without a reload.
- [ ] Checking in on tab A updates tab B in <200ms and blocks a duplicate on tab B.
- [ ] A saved view restores filters, sort, column layout and grouping exactly.

---

## M3 · Run of Show Engine

**Functionality.** A time-aware cue grid replacing the production spreadsheet. Rows are cues; columns are user-defined departments (Audio, Video, Lighting, LED, Camera, Stage, Notes). Per cue: label, duration, item type, per-department cells, prompter script, and an optional wall-clock anchor. Insert, duplicate, reorder (drag or keyboard), group into blocks, and mark cues complete. **Show Caller mode**: full-screen, high-contrast, current/next cue, elapsed vs planned with live drift, `Space` to advance, `←` to step back, `T` to talk to stage. **Timer display** (`/show/:id/timer`) for a stage screen — huge countdown, current segment, producer messages pushed instantly, shareable by link/QR. **Teleprompter** (`/show/:id/prompter`) with adjustable speed, mirror mode, and live script edits.

**Design.** Monospaced time column, zebra-free rows separated by hairlines, department columns color-tinted at 8% opacity. Drift is shown as a signed pill — green under, amber approaching, red over — animated on change, never flashing. Caller mode is dark, enormous type, zero chrome.

**Technical.** Yjs `Y.Array<Y.Map>` for cues, `Y.Text` for scripts, `y-indexeddb` for durability, `y-broadcastchannel` for tabs, awareness for the caller position and remote cursors. **Timing is derived** — one O(n) pass over durations with hard/soft anchor handling — so editing a duration is a single-field CRDT update and the cascade is a recomputation. Actual start times are stamped on advance so post-show you can compare planned vs actual.

**Acceptance**
- [ ] Changing one duration re-times 500 downstream cues in under 16ms with correct anchor behaviour.
- [ ] Two browser windows edit different rows simultaneously, both offline, and merge with no lost edits on reconnect.
- [ ] Advancing the caller in window A moves window B's highlight and the timer display within one animation frame.
- [ ] A producer message reaches the timer display in under 200ms.
- [ ] Printed cue sheet matches the on-screen grid, including only `printed` columns.
- [ ] Reload mid-show restores the exact document, caller position and elapsed state.

---

## M4 · Seating Chart Builder

**Functionality.** A spatial canvas: place and rotate stage/runway/bar/entrance elements, round or rectangular tables, and rows (with configurable seats per row, aisles, tiers/risers). Zones group the room ("Front Row", "Riser Left", "Standing"). Assign guests by dragging from an unseated list, by search, by keyboard, or by auto-seat (fill a zone by tier). Seats are color-coded by tier for instant room-composition read. Rules (`seat-together`, `keep-apart`, `tier-in-zone`, `max-per-table`) evaluate live. Export to print/PDF and PNG; per-guest seat cards.

**Design.** A quiet canvas — dotted grid, snapping, zoom/pan, minimap on large maps. Dragging a guest lifts a small card; valid seats glow, violations show a red hairline and a tooltip explaining which rule. The unseated panel is a collapsible sidebar with its own filters.

**Technical.** dnd-kit for accessible drag with a full keyboard alternative (select seat → `Enter` → search guest → `Enter`). Transform-only dragging, committed to state on drop. Nested seating state mutated through `immer`. Rules run as pure predicates over the assignment map, memoized per element.

**Acceptance**
- [ ] 400 seats drag at 60fps; a 1,200-seat map remains usable.
- [ ] Every seating action is achievable by keyboard alone.
- [ ] Moving a guest between seats updates the guest record, the seat, and both tabs.
- [ ] A rule violation surfaces within one frame and never blocks the producer.
- [ ] Printed map is legible on A3 with a guest-name legend.

---

## M5 · Check-in / Onsite Kiosk

**Functionality.** A stripped-down, touch-first mode for the door. QR scanning through the device camera, fuzzy name search (typo-tolerant), party/plus-one handling, walk-in registration with the event's own custom fields, undo, and a live arrivals counter. Badge printing via print CSS. Kiosk lock (PIN) so staff cannot navigate away accidentally. Works fully offline.

**Design.** Dark, high-contrast, thumb-reachable. Scan feedback is unmistakable: green pulse + name + tier + seat; amber for "already checked in at 19:42"; red for not found, with the closest matches offered. One screen, no menus.

**Technical.** `BarcodeDetector` where available, `@zxing/browser` fallback. Arrivals are **append-only** with an in-transaction Dexie duplicate check, so simultaneous scans on two desks resolve to one arrival. Every mutation enqueues to the offline queue; the status chip shows `n queued` and drains automatically. QR tokens are per-guest stable strings rendered client-side.

**Acceptance**
- [ ] Complete a check-in with DevTools offline, reload, and the arrival persists.
- [ ] Two tabs scanning the same badge produce exactly one arrival and one clear warning.
- [ ] Scan-to-confirmation under 500ms on a mid-tier phone.
- [ ] Walk-in registration writes a guest with the event's custom fields applied.
- [ ] Badge print output fits standard 4×3" stock.

---

## M6 · Experiential Command Center

**Functionality.** A resizable, draggable widget grid simulating oversight of physical experiential tech. Widget registry v1: Arrivals rate · Occupancy by zone · Dwell time heat strip · LED volume / media server status · RFID trigger feed · Throughput funnel · Rundown drift · Next cue · Guest mix by voice · MIV running total · Alerts. Users add, remove, resize, and arrange widgets; multiple named dashboards per event; thresholds drive alert states.

**Design.** Dark by default — this is a show-floor screen. Data-ink first: sparklines, small multiples, one accent per widget, thresholds as subtle bands rather than alarm colors until breached. Every widget declares a compact and an expanded rendering so a 2×2 and a 6×4 both look intentional.

**Technical.** `react-grid-layout` wrapped in Tailwind/shadcn styling; layouts persisted to IndexedDB per dashboard and restored exactly. Widgets are registry entries (`{ key, title, minSize, defaultSize, settingsSchema, Component }`), so adding a widget never touches the grid. Telemetry comes from the deterministic simulator on a `requestAnimationFrame`-throttled tick, written into ring buffers so memory is bounded over a multi-hour show.

**Acceptance**
- [ ] Rearranged and resized layout survives reload and is per-dashboard.
- [ ] Adding a widget type requires only a registry entry (proven by adding one in review).
- [ ] A two-hour simulated run does not grow memory unbounded.
- [ ] Threshold breach raises a visible, dismissible alert with the source named.
- [ ] Widgets render correctly in light mode despite the dark default.

---

## M7 · Metrics & Recap

**Functionality.** MIV and EMV engines with **visible, editable weights**; a formula builder with live preview and validation; per-guest scores and breakdowns; event roll-ups by voice, tier, and platform. Post-event recap: attendance funnel (invited → confirmed → arrived), show performance (planned vs actual per segment), room composition, top contributors, telemetry summary, and total media value — exportable to PDF/print, CSV, and PNG charts.

**Design.** An editorial report, not a dashboard dump: a cover with event identity and headline numbers, then sections with one chart and one sentence of plain-language interpretation each. Charts use the shadcn `Chart` token wrapper so they follow the theme.

**Technical.** Safe formula parser (`lib/formula.ts`, no `eval`), weight tables editable in Studio, scores cached by input hash and recomputed lazily. Both presets ship as ordinary `MetricConfig` records — a user can delete them, edit them, or add "Sponsor Value" alongside.

**Acceptance**
- [ ] Editing a voice-authority weight updates every score, chart and report consistently.
- [ ] An invalid formula highlights the offending token and never crashes a row.
- [ ] A user-authored formula cannot access anything outside the whitelisted grammar (unit-tested with hostile inputs).
- [ ] Recap exports to a print-clean PDF with the workspace brand applied.

---

## M8 · Studio (Customization Surface)

**Functionality.** One place to reshape the app: custom fields per entity (create/reorder/archive), statuses and pipelines, tiers and voices with colors, rundown column sets, metric configs and weight tables, brand tokens (name, logo, fonts, radius, color ramps, default theme), module enable/disable, template authoring, and workspace import/export.

**Design.** A settings surface that feels like product, not config: two-pane layout with live preview — editing a tier color recolors the seating preview beside it; editing a field shows the table cell, detail row and form control it will produce.

**Technical.** Everything writes to `SchemaConfig` / `BrandTokens` / `MetricConfig[]` on the workspace and takes effect immediately through the token and registry layers. Destructive operations archive rather than delete and prompt for a JSON export first.

**Acceptance**
- [ ] A user converts the fashion demo into a corporate-keynote tool — renaming voices, swapping rundown columns, replacing MIV with a custom metric, disabling Seating — without code.
- [ ] Export a workspace, import it into a fresh browser profile, and get an identical app.
- [ ] Archiving a field preserves existing data and hides it everywhere.
- [ ] A test asserts the blank-workspace default schema contains no fashion-specific vocabulary.
