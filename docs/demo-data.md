# Demo Experience & Seed Data

> **Requirement:** "fully usable on web with a demo test examples."

Someone opening the deployed URL with no context must reach a fully populated, credible production in one click — and must be able to leave demo mode for their own workspace just as easily.

## 1. First-run flow

```
Landing
 ├─ Explore the demo        → seeded workspace, demo banner, guided tour offered
 ├─ Start from a template   → template gallery → event wizard → empty but structured
 └─ Start blank             → neutral workspace, no vocabulary assumptions
```

Demo mode is explicit and reversible: a persistent banner reading **"Demo data — Reset · Fork into my workspace · Exit"**. Nothing in demo mode is second-class; every feature works, and forking copies the data into a normal workspace the user owns.

## 2. The four seeded productions

Each is complete across every module — guests, seating, rundown, advancing, arrivals, telemetry, dashboards, recap, settlement — so any entry point lands on real data rather than an empty state.

### A. AURELIA — SS27 Runway (Paris)
The FLB flagship. 420 guests across Celebrity / Influencer / Media / Buyer / Partner voices with plausible follower and engagement distributions (heavy-tailed, not uniform). Front-row politics encoded as seating rules: two guests marked keep-apart, a celebrity pair marked seat-together, a tier-in-zone rule reserving the front row. A three-zone runway map (runway, front row, riser left/right) with 380 seats. A 68-cue rundown with Music, Lighting, Model Order, Camera and Notes columns, hard-anchored at doors and show start. Arrivals concentrated in a 40-minute pre-show spike. High MIV, moderate EMV — deliberately illustrating the metric contrast the research describes.

### B. LUMEN Beauty — Pop-Up Activation (4 days)
The experiential case. Walk-in-heavy check-in, a retail floor map instead of seats, four days of telemetry: occupancy by zone, dwell time at an LED volume, RFID trigger counts at three stations, throughput at the entrance, plus one deliberate threshold breach on day 3 so alerting is visible. A creator content log feeding a running MIV total. Dashboard preconfigured with eight widgets.

### C. NOVA — Product Launch Keynote
The proof the app is not fashion-only. Corporate vocabulary (Analyst / Press / Customer / Partner / Internal), theatre seating with rows and an aisle, a rundown with Slides / Mics / Stream / Lower Thirds columns, teleprompter scripts on four cues, rehearsal blocks, and a custom "Sponsor Value" metric replacing MIV — demonstrating that the metric engine is data, not code.

### D. ATLAS — Tour Date (Amsterdam)
The advance-and-settle case, three days in the past. A 1,500-capacity room with four price bands, an advance at 98% with one line still chasing, three travelling parties with flights, hotel rooms and transfers on a day sheet, and a settlement that resolves the deal the industry actually writes down: €12,000 guaranteed against 70% of net after costs, with the percentage winning on the night. Deductions carry Dutch rates (9% VAT, ticketing, author's rights on the balance); the statement ends at a house result of about €4,300 on €63,000 of gross receipts.

Advancing and settlement are seeded across the other three as well: the upcoming productions carry an advance in progress — some lines confirmed, some chasing, one or two genuinely late — because a finished advance shows nothing, and an advance with three open questions shows the whole point. LUMEN settles against a client fee rather than a box office, which is the same statement with no price bands in it.

## 3. Generation strategy

- **Deterministic.** A seeded PRNG (`mulberry32`, fixed seed per scenario) drives every name, number and timestamp. Record **ids** are seeded too — they are ULIDs built from a fixed epoch plus the scenario's RNG rather than the wall clock — because identical values in a different order are not the same demo. A reset rebuilds the same records in the same order, verified by both a unit test and an end-to-end one.
- **Plausible, not random.** Follower counts are log-normal; engagement rate is inversely correlated with follower count; RSVP conversion varies by tier; arrival times follow a pre-show spike curve; cue durations cluster by item type; telemetry is a smoothed random walk with day/hour seasonality and injected anomalies.
- **Clearly fictional.** Invented names and brands with no real-person or real-brand data. Avatars are generated locally (deterministic gradient + initials) — no external image requests, which also keeps the app fully offline.
- **Cheap to load.** Scenario data generates in a Web Worker from a compact spec (roughly 20KB of JSON parameters, not megabytes of records), streaming into Dexie with a determinate progress bar. Full seed of all four scenarios targets under 1.5 seconds.

```ts
// data/seed/scenario.ts
export interface ScenarioSpec {
  id: 'aurelia' | 'lumen' | 'nova';
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
- Reset touches only workspaces flagged `demo: true` — a user's own workspaces are never in scope, and the confirmation dialog names exactly what will be removed.
- **Fork into my workspace** deep-copies a scenario with fresh ids and clears the demo flag, so a user can start from a realistic production rather than an empty grid.
- Demo mode does not write to any user workspace, and exiting it leaves user data untouched.

## 7. Fixtures for tests

The same generators produce sized fixtures for automated tests: `tiny` (10 guests, 5 cues — component tests), `standard` (420 guests, 68 cues — E2E), `stress` (5,000 guests, 500 cues, 1,200 seats — performance budgets). One generator, three sizes, identical code paths as production data.
