# Design System

Black background. White text. Helvetica. That is the whole thing.

The constraint is the point. When there is only one colour and one typeface, every distinction has to be
earned by lightness, weight, spacing or an edge, and a screen made that way reads the same in a bright office,
on a dimmed laptop at a production desk, through a projector, and on paper.

## 1. Principles

1. **One palette.** Black behind, white in front, and greys that are white lifted off the black by a fixed
   percentage. There are no hues anywhere in `src/styles/index.css`.
2. **One typeface.** Helvetica for headings, body, tables, timers and printed sheets.
3. **Semantic tokens only.** Components use `bg-background`, `text-muted-foreground`, `border-border`,
   `bg-foreground`. A component never writes a colour value of its own.
4. **Meaning is never in the colour**, because there is no colour. It is in the word, the sign, the fill, the
   border, or the dash pattern.
5. **Composition over configuration.** Layouts are assembled from `Sidebar`, `Card`, `Sheet`, `Table` and
   `Chart` primitives. The shadcn components are copied in and ours to restyle.
6. **Motion with intent.** Every animation explains a state change. 150 to 250ms for UI feedback, spring
   physics only for drag. Everything obeys `prefers-reduced-motion`.
7. **Onstage and backstage.** Producer surfaces are dense and keyboard-first. Stage-facing surfaces (timer,
   prompter) are large, calm and readable from twenty feet.

## 2. Tokens

```css
:root {
  --background: hsl(0 0% 0%);
  --foreground: hsl(0 0% 100%);

  --card: hsl(0 0% 6%);            /* raised surfaces, in steps */
  --popover: hsl(0 0% 9%);
  --muted: hsl(0 0% 12%);
  --secondary: hsl(0 0% 14%);
  --accent: hsl(0 0% 16%);

  --muted-foreground: hsl(0 0% 68%);   /* clears 4.5:1 on black */
  --border: hsl(0 0% 22%);
  --input: hsl(0 0% 30%);

  --primary: hsl(0 0% 100%);       /* white is the only emphasis */
  --primary-foreground: hsl(0 0% 0%);

  --chart-1 … --chart-8;           /* 100% down to 44%, paired with dashes */
  --tier-1 … --tier-6;             /* 100% down to 30% */
  --tier-1-foreground … --tier-6-foreground;
  --drift-under / --drift-over;
}
```

There is one theme. `[data-theme='light']` resolves to the same values as `[data-theme='dark']`, so any code
or bookmark that still sets it keeps working.

**Tier colours are data.** They resolve through `--tier-n`, written from `SchemaConfig` at runtime, so a tier
a user adds is a first-class member of the scale.

**Every tier that can be used as a fill has a paired foreground.** A seat in the room carries its label on the
tier grey, and the greys run from white down to near-black, so the ink has to follow the fill. The pairing is
computed from WCAG relative luminance: black clears 4.5:1 down to `--tier-4` (6.5:1) and fails at `--tier-5`
(4.0:1), where white takes over at 5.3:1.

## 3. Telling things apart without colour

| Where | How |
| --- | --- |
| Chart series | Step down the grey scale, and each series takes a different dash. Lightness alone is the first thing a projector or a photograph loses; the dash survives both, and it prints |
| Bars in a bar chart | A background-coloured stroke between neighbours, so two adjacent greys still read as two bars |
| Advance statuses | Missing is a dashed outline, requested is a solid outline, confirmed is a filled block, not needed recedes into the muted surface. A sheet of eighty lines gets visibly quieter as the advance gets done |
| Check-in outcome | Admitted is a solid white block, already in is a quiet outlined panel, not found is a heavy dashed edge that reads as unfinished |
| Drift pill | The sign and the figure carry it. Over its plan is filled, drifting is outlined, on plan is quiet |
| Stage timer | Comfortable time is a softer white, the last minute is full white, running over inverts the block to black on white. Inverting is the loudest thing a two-colour screen can do and it reads from the back of a room |
| Guest tiers | A dot on the grey scale, and the dot always travels with its label |
| Event cover art | A greyscale wash whose angle and brightness come from a hash of the event name, which is enough to tell two cards apart in a list |

## 4. Typography and layout

| Role | Choice |
| --- | --- |
| Everything | `Helvetica, 'Helvetica Neue', 'Nimbus Sans', Arial, sans-serif` |
| Headings | The same stack, set tighter (`-0.02em`) via `.font-display` |
| Body | `-0.006em` tracking |
| Numerals | Tabular figures in every table, timer and rundown, so digits do not jitter as they count |

`--font-sans`, `--font-display` and `--font-mono` all resolve to the one stack. The three names remain because
Tailwind and existing markup reference them.

Layout: 8px spatial rhythm. Content max-width 1440px on marketing-style surfaces and full-bleed on working
surfaces. Sidebar 264px, collapsing to 64px of icons. Sheets are 480px (guest detail) and 640px (settings).

## 5. Component inventory

**From shadcn (copied in and restyled):** Button, Input, Textarea, Select, Combobox, Checkbox, Switch, Radio,
Slider, Label, Form, Dialog, AlertDialog, Sheet, Drawer, Popover, Tooltip, DropdownMenu, ContextMenu, Command,
Tabs, Accordion, Card, Badge, Avatar, Table, Pagination, Toast/Sonner, Skeleton, ScrollArea, Separator,
Resizable, Calendar, DatePicker, Chart.

**Built on top:** `DataTable` (virtualized, view-aware), `FieldRenderer` (custom-field registry),
`EntitySheet`, `EmptyState` (always with a primary action), `CoverArtCropper`, `SeatingCanvas`, `CueGrid`,
`DriftPill`, `WidgetGrid`, `MetricRadar`, `StatTile`, `StatusChip`, `ImportWizard`, `FormulaEditor`,
`GuidedTour`, `ItemRow` (one line of the advance).

## 6. Accessibility

These are not negotiable, and CI enforces them with axe across eleven routes:

- Every Dialog, Sheet and Drawer carries a title, visually hidden where the design has no visible header.
- Focus is trapped and restored.
- Every drag interaction has a keyboard equivalent.
- Live regions announce check-ins and cue advances.
- Text clears 4.5:1 and UI clears 3:1.

A single-colour palette makes the last one easier to reason about and easier to get wrong in one specific way:
a grey used as a fill needs its own paired foreground. That is what `--tier-n-foreground` exists for, and it is
the first thing to add when a new grey fill appears.

## 7. Empty, loading and error states

- **Empty is never blank.** A typographic empty state with one sentence of context and one primary action
  ("Import a guest list", "Add your first cue", "Load demo data").
- **Loading is rare by design**, because the data is local. Where it exists (image processing, imports,
  exports) it is a determinate progress bar.
- **Errors are actionable.** What failed, what is safe, and what to do next. Any error that threatens data
  offers "Export a backup now".

## 8. Print

Print is a real output in this industry. There are dedicated print stylesheets for the advance sheet, the cue
sheet (landscape, chosen columns, page-broken by block, header with event and timestamp), the seating map (A3
with a legend), badges (4x3 inches) and the recap report.

Paper inverts: white page, black ink. That keeps the palette monochrome and keeps the ink bill down. The dash
patterns on chart series are what make a printed chart readable, which is why they are in the design and not
just in the rendering.

## 9. House style for copy

- **No em dashes.** Use a full stop, a comma or brackets. Enforced by lint.
- **Say what a thing does, not what it is not.** Avoid "X, not Y" and "X instead of Y" framing.
- **Write like a person talking to a colleague.** Short sentences. Plain words.
