# BabyProducer

**One place for everything an event needs.**

BabyProducer takes the work that fills the weeks before a show and holds it in one structure. Everything sits
under the same show, from the rider to the travel for everyone coming in to the production contacts and the
timings, and as things fall into place a checklist reads them back as a readiness number while a panel keeps
whatever is still open in plain sight, so the advance is shared across the team from the first week onwards.

Most teams run the advance out of a mail thread and a spreadsheet. The thread has the answers in it somewhere.
The spreadsheet is on someone's laptop. Nobody can tell you, in one number, how ready the show is.

Everything an event needs after the advance lives here too, which means the guest list and the artist +1s, the
seating chart nobody wants to build twice, a run of show that shifts on its own when the opener runs long, and
door check-in that carries on scanning while the venue Wi-Fi does whatever venue Wi-Fi does. At the end of the
night you settle up in the same place, without carrying a pile of receipts home with you.

**It all runs in your browser.** No server, no account, no analytics. Guest data is real personal information
when this is used for real, and it never leaves the device.

## Try it

```bash
npm install
npm run dev     # then open the URL it prints and click "Explore the demo"
```

The demo builds four complete productions on your machine in about a second: a club night, a festival stage, a
brand launch, and a tour date that has already been played and settled. It comes from a fixed seed, so
**Reset** rebuilds it exactly, and **Copy to my workspace** forks it into one you own.

## Advancing

This is the centre of the product, and the first thing in the navigation.

| What you get | Why it matters |
| --- | --- |
| A checklist per show, grouped into sections you control | One place where the whole advance lives |
| A readiness figure, 0 to 100% | Answers "how ready are we" in one number |
| A "still missing" panel above the checklist | The three unanswered lines are the hardest thing to see in a mail thread, so they go first |
| Travelling parties, with flights, hotels and transfers | Repeats the same travel questions for every person coming in |
| Production contacts | Nobody hunts through email at 2am for the crew chief's number |
| A day sheet, built from the answers | Chronological, printable, always current |
| Dates, with overdue marked | What has slipped, without reading the whole sheet |
| A printable advance sheet | The version you send the venue |

Nothing on the sheet is stored twice. Readiness, what is missing and the day sheet are all worked out from the
items themselves, so a status you change is reflected everywhere the moment you change it.

## Everything else a show needs

| Module | What you get |
| --- | --- |
| **Guests & talent** | Thousands of rows, virtualized. Filters built from your own vocabulary, custom fields, CSV import with column mapping, and a detail sheet with a media-value breakdown |
| **Seating** | A room built to your capacity. Drag or keyboard assignment, tier shading, and rules that warn about keep-apart, seat-together, tier-in-zone and table limits without blocking you |
| **Run of show** | A time-aware cue grid where editing one duration re-times everything below it. Hard and soft anchors, a show caller (space bar advances), a stage timer and a teleprompter on their own links, and a printable cue sheet |
| **Check-in** | Typo-tolerant door search, QR scanning, a duplicate guard across desks, walk-ins, locally generated badges. Works with the network off |
| **Command center** | A widget grid over live telemetry. Layout saved per dashboard, with threshold alerts |
| **Recap** | Attendance funnel, arrival pattern, room composition, top contributors, planned against actual timing, CSV export |
| **Settlement** | Box office by price band, off-the-top deductions, show costs, and deals (flat, percentage, guarantee versus percentage, guarantee plus bonus) resolved into payouts, a house P&L and a statement that prints to PDF |
| **Studio** | Vocabulary, custom fields, metric formulas and weights, module toggles, workspace import and export |

## Design

Black background, white text, Helvetica. That is the whole palette and the whole type system.

There are no hues anywhere in the stylesheet. Anything that used to carry meaning through colour now carries
it through lightness, weight or an edge. Chart series step down a grey scale and each one takes a different
dash, so they survive a projector and a printout. Advance statuses go from a dashed outline (missing) to a
solid outline (requested) to a filled block (confirmed), which means a sheet of eighty lines gets visibly
quieter as the advance gets done. The stage timer inverts to black on white when a cue runs over, because
inverting is the loudest thing a two-colour screen can do and it reads from the back of a room.

Every tier grey is paired with the ink that actually clears 4.5:1 on it, worked out from relative luminance.
Every surface is scanned with axe in CI.

## How it is built

Vite, React, TypeScript in strict mode, Tailwind v4 with semantic tokens, shadcn-style components owned in the
repo, Zustand with immer slices, Dexie over IndexedDB, Yjs for the rundown CRDT, TanStack Virtual,
react-grid-layout, Recharts, vite-plugin-pwa, Vitest, Playwright and axe, GitHub Actions to GitHub Pages.

Three ideas carry most of the weight:

1. **Local-first.** Every read and write hits IndexedDB. The network is never on the critical path, because
   venue Wi-Fi fails and the show does not.
2. **Derived, never stored.** Cue start times are computed from durations and anchors on every render, and so
   is every figure on a settlement statement. That is what makes the drift cascade fast, what makes the CRDT
   safe (there is no derived data to conflict over), and why a settlement re-run at 1am as the door count
   firms up cannot disagree with the numbers underneath it.
3. **Vocabulary is data.** No `Celebrity | Influencer | Media` union exists anywhere in the code. Tiers,
   voices, statuses, cue columns, metric formulas and weights are records you edit, held in place by a lint
   rule that keeps industry words out of the app and in `data/templates.ts` and `data/seed/`.

## Scripts

```bash
npm run dev        # dev server
npm run build      # typecheck, build, write the SPA 404 fallback
npm test           # unit and component tests
npm run e2e        # Playwright, including offline, cross-tab and axe checks
npm run size       # bundle budget (the eager shell stays under 250KB gz)
npm run lint       # includes the domain-neutrality rule and the house style rules
```

## House style

Two rules are enforced by lint, so they cannot drift back in:

- **No em dashes.** Use a full stop, a comma or brackets.
- **Industry vocabulary stays in the data.** It never reaches app code.

And one that is not lintable, so it is written down here: **say what a thing does, not what it is not.** Avoid
"X, not Y" and "X instead of Y" framing. State the positive.

## Upgrading from Atelier

The product used to be called Atelier, and the database was named after it. A device that has been running the
old build still holds its only copy of the work under that name, so on first run BabyProducer copies the old
database across and leaves the original where it is. Workspace exports written by the old build still import.

## Documentation

| Document | Contents |
| --- | --- |
| [docs/PLAN.md](./docs/PLAN.md) | Scope, modules, roadmap, risks, decisions |
| [docs/architecture.md](./docs/architecture.md) | Stack, state, offline and PWA, CRDT, cross-tab sync, performance |
| [docs/data-model.md](./docs/data-model.md) | Entities, Dexie schema, custom fields, metric engine |
| [docs/modules.md](./docs/modules.md) | Per-module specs and acceptance criteria |
| [docs/design-system.md](./docs/design-system.md) | Tokens, type, motion, accessibility, print |
| [docs/customization.md](./docs/customization.md) | The seven customization layers |
| [docs/demo-data.md](./docs/demo-data.md) | Scenarios, deterministic generation, tour, reset |
| [docs/testing-and-deployment.md](./docs/testing-and-deployment.md) | Test pyramid, CI/CD, GitHub Pages, browser matrix |

## Deploying

Push to `main` and the Pages workflow builds with `VITE_BASE=/<repo>/`, writes a `404.html` SPA fallback and
deploys. For a custom domain, leave `VITE_BASE` unset.
