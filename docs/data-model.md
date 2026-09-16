# Data Model

Everything here lives in the browser (Dexie/IndexedDB). Ids are ULIDs — sortable and collision-free across offline devices. Every record carries `createdAt`, `updatedAt`, and `rev` (a monotonic counter used for last-write-wins on the non-CRDT paths).

## 1. Entity map

```
Workspace
 ├─ BrandTokens          theme, fonts, logo, app name
 ├─ SchemaConfig         custom fields, statuses, tiers, advance sections, party roles,
 │                      expense categories, rundown columns
 ├─ MetricConfig[]       MIV/EMV/custom scoring definitions
 ├─ EventTemplate[]      reusable event blueprints
 └─ Event[]
     ├─ Guest[]          ──┐
     ├─ Company[]          │ CRM
     ├─ Interaction[]    ──┘
     ├─ Rundown          (Yjs doc: cues, columns, prompter text)
     ├─ SeatingMap[]     zones → tables/rows → seats → assignments
     ├─ AdvanceSheet     parties, contacts, checklist items (one row per event)
     ├─ SettlementSheet  scaling, deductions, costs, deal terms (inputs only)
     ├─ Arrival[]        check-in events (append-only)
     ├─ Dashboard[]      widget layouts
     ├─ TelemetrySeries[] simulated sensor feeds
     └─ Asset[]          cover art, logos, badge templates (Blobs)
```

## 2. Core interfaces

```ts
type ULID = string;
type ISODate = string;      // '2027-03-04T19:30:00.000Z'
type Seconds = number;

interface Workspace {
  id: ULID;
  name: string;
  brand: BrandTokens;
  schema: SchemaConfig;
  metrics: MetricConfig[];
  enabledModules: ModuleKey[];       // module toggles — see customization.md
  demo: boolean;                     // true for the seeded sandbox
}

interface Event {
  id: ULID;
  workspaceId: ULID;
  name: string;
  kind: string;                      // free text, not an enum: 'Runway Show', 'Pop-Up'…
  status: string;                    // from schema.statuses.event
  startsAt: ISODate;
  endsAt: ISODate;
  timezone: string;                  // IANA; all display converts from UTC
  venue: Venue;
  capacity: number | null;
  cover: AssetRef | null;            // enforced 1:1, ≥800×800
  theme: ThemeOverride | null;       // per-event theme, inherits workspace brand
  fields: Record<string, FieldValue>; // custom fields
  moduleOverrides: Partial<Record<ModuleKey, boolean>>;
}
```

### Guest & talent

Deliberately neutral: there is no `Celebrity | Influencer | Media` enum in the code. `tier` and `voice` reference **user-defined** entries in `SchemaConfig`.

```ts
interface Guest {
  id: ULID;
  eventId: ULID;
  name: string;
  handle?: string;                   // @social handle
  companyId?: ULID;
  tierId?: string;                   // → schema.tiers[]  e.g. 'A-list', 'Buyer', 'Press'
  voiceId?: string;                  // → schema.voices[] e.g. 'Celebrity', 'Media'
  statusId: string;                  // → schema.statuses.guest: Invited→Confirmed→Arrived…
  email?: string;
  phone?: string;
  plusOnes: number;
  seatId?: ULID;
  audience?: AudienceStats;          // reach inputs for the metric engine
  scores?: Record<string, number>;   // computed per MetricConfig.id, cached with an input hash
  tags: string[];
  notes?: string;
  fields: Record<string, FieldValue>; // custom fields
  qrToken: string;                   // stable, used for badge QR
}

interface AudienceStats {
  followers?: number;
  avgEngagementRate?: number;        // 0..1
  platform?: string;                 // user-defined platform list
  impressions?: number;
  publicationTier?: string;
}
```

### Rundown

The rundown is a Yjs document; this is its logical shape.

```ts
interface RundownMeta {
  eventId: ULID;
  showStart: ISODate;
  columns: RundownColumn[];          // fully user-defined departments
  callerCueId: ULID | null;          // broadcast via Yjs awareness
}

interface RundownColumn {
  id: string;
  label: string;                     // 'Audio', 'Lighting', 'LED', 'Camera', 'Notes'
  type: 'text' | 'longtext' | 'select' | 'checkbox' | 'person' | 'asset';
  options?: string[];
  width: number;
  color?: string;
  printed: boolean;                  // included in the printed cue sheet
}

interface Cue {
  id: ULID;
  label: string;
  durationSec: Seconds;
  anchor?: { at: ISODate; mode: 'hard' | 'soft' };  // pinned wall-clock time
  itemType: string;                  // user-defined: 'Segment', 'Video', 'Walk', 'Speech'
  cells: Record<string /* columnId */, FieldValue>;
  prompterKey?: string;              // → Y.Text
  actualStart?: ISODate;             // stamped when the caller advances
  actualDuration?: Seconds;
}
```

**Derived timing** (pure function, never persisted):

```ts
function deriveTimes(showStart, cues): Array<{ plannedStart: ISODate; drift: Seconds }>
```

Walk the array accumulating durations. A **hard anchor** resets the running clock to its wall time (and reports the resulting gap or overrun as drift). A **soft anchor** is advisory: it reports drift but does not reset. This is the Shoflo auto-drift cascade, and it is one O(n) pass.

### Seating

```ts
interface SeatingMap {
  id: ULID; eventId: ULID; name: string;
  canvas: { width: number; height: number; gridSize: number; background?: AssetRef };
  zones: Zone[];                     // 'Front Row', 'Riser Left', 'Standing'
  elements: SeatingElement[];        // tables, rows, stage, runway, bar, entrance
  rules: SeatingRule[];
}

type SeatingElement =
  | { kind: 'stage' | 'runway' | 'prop'; id: ULID; zoneId?: string; x: number; y: number; w: number; h: number; rotation: number; label: string }
  | { kind: 'table'; shape: 'round' | 'rect'; seats: Seat[]; /* + geometry */ }
  | { kind: 'row'; seats: Seat[];       /* + geometry */ };

interface Seat { id: ULID; label: string; guestId?: ULID; locked?: boolean; tierHint?: string; }

interface SeatingRule {
  id: string;
  type: 'seat-together' | 'keep-apart' | 'tier-in-zone' | 'max-per-table';
  subjects: ULID[] | { tierId: string };
  target?: string;                   // zoneId / tableId
  severity: 'warn' | 'block';
}
```

Rules evaluate on every assignment and surface inline (a red hairline on the seat plus a violations panel) rather than blocking the drag — producers overrule rules constantly and the tool must let them.

### Check-in

Append-only, so two tabs or two desks can never "lose" an arrival:

```ts
interface Arrival {
  id: ULID; eventId: ULID; guestId: ULID;
  at: ISODate;
  method: 'qr' | 'search' | 'walk-in' | 'manual';
  deviceId: string;                  // per-browser, for audit
  partySize: number;
  undone?: boolean;                  // undo writes a new record, never a delete
}
```

Current status = reduction over arrivals. Duplicate detection reads Dexie inside the write transaction, not the in-memory store.

### Telemetry (simulated experiential sensors)

```ts
interface TelemetrySeries {
  id: ULID; eventId: ULID;
  source: string;                    // 'LED Volume A', 'RFID Gate 3', 'Depth Cam — Atrium'
  metric: 'occupancy' | 'dwellSec' | 'throughput' | 'interactions' | 'uptime' | string;
  unit: string;
  points: Array<{ t: ISODate; v: number }>;
  thresholds?: { warn?: number; critical?: number };
}
```

Generated by the deterministic simulator ([demo-data.md](./demo-data.md)). The widget layer does not know or care that the source is simulated — swapping in a real feed later is an adapter, not a rewrite.

## 3. Custom fields

The mechanism that makes "fully customizable" real. One definition type, applied to any entity.

```ts
type FieldKind =
  | 'text' | 'longtext' | 'number' | 'currency' | 'percent'
  | 'select' | 'multiselect' | 'boolean' | 'date' | 'datetime'
  | 'url' | 'email' | 'phone' | 'person' | 'relation' | 'file' | 'formula';

interface FieldDef {
  id: string;                        // stable key used in `fields`
  entity: 'event' | 'guest' | 'company' | 'cue' | 'seat' | 'vendor';
  label: string;
  kind: FieldKind;
  options?: Array<{ value: string; label: string; color?: string }>;
  required?: boolean;
  defaultValue?: FieldValue;
  formula?: string;                  // for kind: 'formula' — see §4
  helpText?: string;
  showIn: Array<'table' | 'detail' | 'form' | 'badge' | 'print'>;
  order: number;
  archived?: boolean;                // archive, never hard-delete — preserves history
}
```

- **Validation** is generated at runtime: `fieldDefsToZod(defs)` produces the schema react-hook-form validates against. Adding a field adds validation with no code change.
- **Storage** is a sparse `fields` record per entity, so adding or archiving a field requires no data migration.
- **Rendering** is registry-driven: `FIELD_RENDERERS[kind]` supplies table cell, detail row, and form control. A new field kind is one registry entry.

## 4. Metric engine (MIV / EMV / custom)

The research is explicit that EMV is volume-centric and MIV is authority-weighted, and that a credible product must model both — with the weights visible and editable, because opaque multipliers are precisely EMV's weakness.

```ts
interface MetricConfig {
  id: string;                        // 'miv' | 'emv' | user-defined
  label: string;
  description?: string;
  formula: string;                   // a safe expression, see below
  variables: MetricVariable[];       // how each token resolves from a Guest
  weightTables: WeightTable[];       // editable lookup tables
  format: { style: 'currency' | 'number' | 'percent'; currency?: string; decimals: number };
  breakdown: string[];               // variable ids charted on the radar
}

interface WeightTable {
  id: string;                        // 'voiceAuthority', 'platformCpm', 'contentQuality'
  label: string;
  keyedBy: 'voiceId' | 'tierId' | 'platform' | string;
  entries: Record<string, number>;   // fully editable in Studio
  fallback: number;
}
```

**Shipped presets** (both editable, neither hardcoded into logic):

```
EMV = (impressions / 1000) * platformCpm[platform] * engagementMultiplier
MIV = reach * mediaRate[voiceId] * mediaQuality[tierId] * contentQuality
```

**Safe evaluation.** Formulas are parsed into an AST by a small Pratt parser (`lib/formula.ts`) over a whitelist: numbers, identifiers, `+ - * / ^ ( )`, comparisons, ternaries, and a fixed function set (`min`, `max`, `round`, `clamp`, `lookup`, `coalesce`, `log`). No `eval`, no `Function` constructor, no property access — a user-authored formula cannot reach the DOM or the store. Unknown identifiers fail validation in the editor with the offending token highlighted, and evaluation errors degrade to `null` with a visible badge rather than crashing a row.

**Caching.** A score is stored on the guest with a hash of `(formula, weights, inputs)`. Editing a weight invalidates by hash and recomputes lazily during table virtualization, so changing a multiplier on 5,000 guests is instant.

## 5. Dexie schema

```ts
db.version(1).stores({
  workspaces: 'id, name',
  events:     'id, workspaceId, startsAt, status',
  guests:     'id, eventId, statusId, tierId, voiceId, name, seatId, *tags',
  companies:  'id, eventId, name',
  interactions:'id, eventId, guestId, at',
  seatingMaps:'id, eventId',
  arrivals:   'id, eventId, guestId, at',
  telemetry:  'id, eventId, source, metric',
  dashboards: 'id, eventId',
  assets:     'id, eventId, kind',       // Blob storage
  rundowns:   'eventId',                 // Yjs update payload (Uint8Array)
  templates:  'id, workspaceId, kind',
  meta:       'key',                     // schemaVersion, deviceId, flags
});
```

Version 2 adds advancing and settlement:

```ts
db.version(2)
  .stores({
    advanceSheets: 'id, eventId',        // parties + contacts + checklist items
    settlements:   'id, eventId',        // box office, costs and deal terms
  })
  .upgrade(/* backfills the three new vocabulary lists onto every workspace */);
```

Both are one row per event rather than a row per line. An advance and a settlement are each a single document several people edit over weeks, and keeping them whole means a party rename or a re-ordered price band is one write instead of twenty — at the cost of read-modify-write on every change, which is the right trade at this size. Reading a workspace also passes its schema through `backfillSchema()`, so a record written before a vocabulary list existed still opens.

Compound indexes (`[eventId+statusId]`, `[eventId+at]`) are added with the queries that need them. Every subsequent version ships an `upgrade()` that is unit-tested against a fixture database of the previous version — a schema migration that silently drops a live guest list is the worst failure this app can have.

## 6. Import / export

| Direction | Formats | Notes |
| --- | --- | --- |
| Import | CSV/TSV (guests, cues), JSON (full workspace/event), ICS (schedule) | Column-mapping wizard with fuzzy header matching, type coercion preview, duplicate strategy (skip / merge / create), and unknown columns optionally promoted to custom fields |
| Export | JSON (workspace, event, template), CSV (any saved view), ICS, PDF/print (rundown, seating, badges), PNG (seating map, charts) | JSON export is the portability guarantee and the backup story |

A workspace JSON export contains schema, metrics, brand tokens, templates and data — so a user's customizations move between browsers and machines, and a template can be shared as a file.
