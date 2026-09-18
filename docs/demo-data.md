# Demo Experience & Seed Data

> **Requirement:** "fully usable on web with a demo test examples."

Someone opening the deployed URL with no context must reach a fully populated, credible production in one click, and must be able to leave demo mode for their own workspace just as easily.

## 1. First-run flow

```
Landing
 ├─ Explore the demo        → seeded workspace, demo banner, guided tour offered
 ├─ Start from a template   → template gallery → event wizard → empty but structured
 └─ Start blank             → neutral workspace, no vocabulary assumptions
```

Demo mode is explicit and reversible: a persistent banner reading **"Demo data. Reset · Fork into my workspace · Exit"**. Nothing in demo mode is second-class; every feature works, and forking copies the data into a normal workspace the user owns.

## 2. The four seeded productions

Each is complete across every module (guests, seating, rundown, advancing, arrivals, telemetry, dashboards, recap and settlement), so every entry point lands on real data.

### A. Club Night (Berlin, 700 cap)
The door case, twelve days out. 520 guests across DJ / Crew / Promoter / Press / Guest voices, tiered from All Access down to Door, with plausible follower and engagement distributions (heavy-tailed). Standing room rather than a seating chart. A thirteen-cue stack — doors, three opening sets each with the changeover after it, the headline set, a close-out and the curfew — hard-anchored at doors, so an opener running long pushes the curfew and the sheet says so. Arrivals concentrated in a spike after doors, with a real walk-in rate on the night.

### B. Festival Stage (London, one day)
The timing case, five weeks out. One stage on a site somebody else runs: published set times, a shared backline, a changeover window between every act and a hard stop nobody negotiates. 900 accredited people across Artist / Crew / Production / Press / Guest, tiered All Access down to Wristband. Its advance is deliberately the least finished of the four, four parties deep with the artist advance repeating per act, because a sheet with plenty still open is the one the "still missing" panel exists for.

### C. Brand Launch (London)
The seated case, six days in the past. A keynote for 900 in a theatre room before the room turns over for the reception — invited a thousand, the way a launch always is, so the chart has real gaps and a real unseated list. Seating politics encoded as rules: two guests marked keep-apart, a pair marked seat-together, a tier-in-zone rule holding the front for the top tier. Telemetry from an activation's sensors: occupancy by zone, dwell time, throughput at the entrance, plus a deliberate threshold breach so alerting is visible. It settles against a client fee, which is the same statement with no price bands in it.

### D. Tour Date (Amsterdam)
The advance-and-settle case, three days in the past. A 1,500-capacity room with four price bands, an advance at 98% with one line still chasing, three travelling parties with flights, hotel rooms and transfers on a day sheet, and a settlement that resolves the deal the industry actually writes down: €12,000 guaranteed against 70% of net after costs, with the percentage winning on the night. Deductions carry Dutch rates (9% VAT, ticketing, author's rights on the balance).

Advancing and settlement are seeded across all four: the upcoming productions carry an advance in progress, some lines confirmed, some chasing, one or two genuinely late, because a finished advance shows nothing, and an advance with three open questions shows the whole point.

## 3. Generation strategy

- **Deterministic.** A seeded PRNG (`mulberry32`, fixed seed per scenario) drives every name, number and timestamp. Record **ids** are seeded too. They are ULIDs built from a fixed epoch plus the scenario's RNG, so the wall clock never reaches them. Identical values in a different order would not be the same demo. A reset rebuilds the same records in the same order, verified by both a unit test and an end-to-end one.
- **Plausible.** Follower counts are log-normal; engagement rate is inversely correlated with follower count; RSVP conversion varies by tier; arrival times follow a pre-show spike curve; cue durations cluster by item type; telemetry is a smoothed random walk with day/hour seasonality and injected anomalies.
- **Clearly fictional.** Invented names and brands with no real-person or real-brand data. Avatars are generated locally (deterministic gradient + initials), no external image requests, which also keeps the app fully offline.
- **Cheap to load.** Scenario data generates in a Web Worker from a compact spec (roughly 20KB of JSON parameters, not megabytes of records), streaming into Dexie with a determinate progress bar. Full seed of all four scenarios targets under 1.5 seconds.

```ts
// data/seed/scenario.ts
export interface ScenarioSpec {
  id: 'club-night' | 'festival' | 'launch' | 'tour';
  seed: number;
  template: EventTemplateRef;
  guests: { count: number; voiceMix: Record<string, number>; tierMix: Record<string, number>;
            rsvpConversion: Record<string, number>; };
  seating: SeatingSpec;
  rundown: { cueCount: number; blocks: BlockSpec[]; anchors: AnchorSpec[] };
  arrivals: { curve: 'preshow-spike' | 'steady' | 'walk-in-heavy'; noShowRate: number };
  telemetry: { sources: TelemetrySourceSpec[]; anomalies: AnomalySpec[] };
  dashboard: WidgetLayoutSpec[];
}
```

## 4. Simulate Live

A demo cannot prove a real-time product with static data. **Simulate Live** starts a clock-driven simulator for the selected event:

- The rundown runs: the caller advances through cues at plausible (slightly imperfect) pace, producing real drift you watch accumulate and recover.
- Arrivals fire against the check-in module, incrementing counters and flipping guest statuses in every open tab.
- Telemetry streams into the Command Center, including the scripted threshold breach and its alert.
- Speed control (1× / 10× / 60×), pause, and reset. The whole run is deterministic, so a demo is repeatable.

This is also the E2E test harness: Playwright drives the same simulator at 60× to exercise hours of show in seconds.

## 5. Guided tour

A five-stop tour (skippable, resumable, never modal-blocking) hitting the product's actual argument: **Guest CRM → Seating → Rundown + caller → Check-in cross-tab → Command Center**. Each stop is one sentence plus one interactive action the user performs themselves. A final stop points at Studio: "now make it yours." Tour state persists per browser so it never re-nags.

## 6. Reset and safety

- **Reset demo data** restores the pristine seed in under two seconds (drop the demo workspace's tables, re-run the generator).
- Reset touches only workspaces flagged `demo: true`, a user's own workspaces are never in scope, and the confirmation dialog names exactly what will be removed.
- **Fork into my workspace** deep-copies a scenario with fresh ids and clears the demo flag, so a user starts from a realistic production instead of a blank grid.
- Demo mode does not write to any user workspace, and exiting it leaves user data untouched.

## 7. Fixtures for tests

The same generators produce sized fixtures for automated tests: `tiny` (10 guests, 5 cues. Component tests), `standard` (420 guests, 68 cues. E2E), `stress` (5,000 guests, 500 cues, 1,200 seats. Performance budgets). One generator, three sizes, identical code paths as production data.
