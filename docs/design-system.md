# Design System — "Vibe Coding" Parameters

The research is blunt about the target: editorial and immersive, not a sterile corporate dashboard. Aesthetic decisions are treated as engineering requirements, with the same acceptance criteria as logic.

## 1. Principles

1. **Editorial over enterprise.** Generous whitespace, high contrast, few borders, type doing the structural work.
2. **Semantic tokens only.** Components use `bg-background`, `text-muted-foreground`, `border-border`, `bg-primary` — never `bg-blue-500`. Theme switching and per-event theming then become a variable swap that charts, tables and canvases follow for free.
3. **Composition over configuration.** Layouts are assembled from `Sidebar`, `Card`, `Sheet`, `Table`, `Chart` primitives rather than monolithic configurable components. Copy-in shadcn components are ours to restyle.
4. **Motion with intent.** Every animation explains a state change. 150–250ms for UI feedback, ~420ms for the theme crossfade, spring physics only for drag. Everything obeys `prefers-reduced-motion`.
5. **Onstage vs backstage.** Producer surfaces are dense and keyboard-first. Guest- and stage-facing surfaces (cover pages, timer, prompter) are large, calm and unmistakable from twenty feet away.

## 2. Token architecture

```css
:root {
  /* base ramp — overridden per workspace brand and per event theme */
  --background: 0 0% 100%;
  --foreground: 240 10% 4%;
  --muted: 240 5% 96%;
  --muted-foreground: 240 4% 46%;
  --border: 240 6% 90%;
  --primary: 262 83% 58%;            /* brand accent */
  --primary-foreground: 0 0% 100%;
  --accent-glow: 262 83% 58%;        /* theme crossfade hue */
  --radius: 0.75rem;

  /* domain tokens — semantics the product actually needs */
  --tier-1 … --tier-6;               /* guest tiers, user-editable */
  --status-ok / --status-warn / --status-critical;
  --drift-under / --drift-over;
  --chart-1 … --chart-8;
}

:root[data-theme='dark'] { /* full re-declaration */ }
@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) { /* … */ } }
```

- **Workspace brand tokens** override the base ramp. **Event themes** override again, scoped to the event layout element, so two events open in two tabs each keep their own identity.
- **Tier colors are data, not CSS.** They resolve through `--tier-n` variables written from `SchemaConfig` at runtime, so a user-added tier is a first-class citizen of the palette.
- Color never carries meaning alone: tier dots pair with labels, drift pills pair with signs, alerts pair with icons.

## 3. Theme crossfade (the signature interaction)

Changing an event theme should feel like the room changing color, not like a form field updating.

```
1. Snapshot current accent hue.
2. Mount a fixed, pointer-events-none gradient layer at the new hue, opacity 0.
3. Animate opacity 0→1 over 420ms (cubic-bezier .4,0,.2,1) while CSS variables
   transition on the root element.
4. Unmount the layer. Total: one paint, no layout thrash, no component remount.
5. Under prefers-reduced-motion: variables swap instantly, no layer.
```

The same primitive powers the landing page's ambient gradient and the Command Center alert wash.

## 4. Typography and layout

| Role | Choice |
| --- | --- |
| Display / event names | A high-contrast editorial serif or a wide grotesque (self-hosted, variable, subset) |
| UI | `Inter` variable, `-0.011em` tracking at body sizes |
| Numerals | Tabular figures everywhere in tables, timers and rundowns — digits must not jitter as they count |
| Timers / durations | Monospace, `font-variant-numeric: tabular-nums`, sized for legibility at distance |

Layout: 8px spatial rhythm; content max-width 1440px on marketing-style surfaces, full-bleed on working surfaces; sidebar 280px collapsible to 64px icons; sheets 480px (guest detail) and 640px (settings).

## 5. Component inventory

**From shadcn (copied in and restyled):** Button, Input, Textarea, Select, Combobox, Checkbox, Switch, Radio, Slider, Label, Form, Dialog, AlertDialog, Sheet, Drawer, Popover, Tooltip, DropdownMenu, ContextMenu, Command (⌘K), Tabs, Accordion, Card, Badge, Avatar, Table, Pagination, Toast/Sonner, Skeleton, ScrollArea, Separator, Resizable, Calendar, DatePicker, Chart.

**Built on top:** `DataTable` (virtualized, view-aware), `FieldRenderer` (custom-field registry), `EntitySheet`, `EmptyState` (always with a primary action), `ThemeCrossfade`, `CoverArtCropper`, `SeatingCanvas`, `CueGrid`, `DriftPill`, `WidgetGrid`, `MetricRadar`, `StatTile`, `StatusChip` (online/offline/queued), `ImportWizard`, `FormulaEditor`, `GuidedTour`.

**Accessibility rules that are non-negotiable:** every Dialog/Sheet/Drawer carries a `DialogTitle`/`SheetTitle` (visually hidden where the design has no visible header); focus is trapped and restored; drag interactions have keyboard equivalents; live regions announce check-ins and cue advances; contrast ≥4.5:1 for text and ≥3:1 for UI, verified in both themes.

## 6. Dark mode

Dark is the default on production surfaces (Command Center, caller, kiosk, timer) because they run in dark venues; light is the default on planning surfaces. Both are fully supported everywhere, and the choice is a workspace brand token. Because charts read `--chart-n` through the shadcn `Chart` wrapper, no chart contains a conditional color expression.

## 7. Empty, loading and error states

- **Empty is never blank:** an illustration-free, typographic empty state with one sentence of context and a primary action ("Import a guest list", "Add your first cue", "Load demo data").
- **Loading is rare by design** — data is local. Where it exists (image processing, imports, exports) it is a determinate progress bar, not a spinner.
- **Errors are actionable:** what failed, what is safe, and what to do next. Any data-threatening error offers "Export a backup now".

## 8. Print

Print is a real output for this industry. Dedicated print stylesheets for: the cue sheet (landscape, chosen columns, page-broken by block, header with event/version/timestamp), the seating map (A3 with legend), badges (4×3"), and the recap report. Print output uses ink-economical light tokens regardless of screen theme.
