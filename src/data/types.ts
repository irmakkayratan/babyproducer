/**
 * Domain types.
 *
 * Deliberately free of industry vocabulary: there is no
 * `Celebrity | Influencer | Media` union anywhere in this file. Categorical
 * axes reference user-defined entries in `SchemaConfig`, which is what makes
 * the app reshapeable without code changes (see docs/customization.md).
 */

export type ULID = string;
export type ISODate = string;
export type Seconds = number;

export type FieldValue = string | number | boolean | string[] | null;

export type ModuleKey =
  | 'guests'
  | 'seating'
  | 'rundown'
  | 'checkin'
  | 'command'
  | 'metrics';

export const ALL_MODULES: ModuleKey[] = [
  'guests',
  'seating',
  'rundown',
  'checkin',
  'command',
  'metrics',
];

export interface Timestamped {
  createdAt: ISODate;
  updatedAt: ISODate;
  rev: number;
}

/* ------------------------------------------------------------------ brand */

export interface BrandTokens {
  appName: string;
  logoAssetId?: ULID;
  accent: string; // hsl(...) applied to --primary / --ring / --shell-gradient
  radius: number; // rem
  defaultScheme: 'dark' | 'light' | 'system';
  displayFont: 'serif' | 'sans';
}

export interface ThemeOverride {
  accent: string;
  scheme?: 'dark' | 'light';
  gradient?: string;
}

/* ----------------------------------------------------------------- schema */

export type FieldKind =
  | 'text'
  | 'longtext'
  | 'number'
  | 'currency'
  | 'percent'
  | 'select'
  | 'multiselect'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'url'
  | 'email'
  | 'phone'
  | 'relation'
  | 'file'
  | 'formula';

export type FieldEntity = 'event' | 'guest' | 'company' | 'cue' | 'seat';

export interface FieldOption {
  value: string;
  label: string;
  color?: string;
}

export interface FieldDef {
  id: string;
  entity: FieldEntity;
  label: string;
  kind: FieldKind;
  options?: FieldOption[];
  required?: boolean;
  defaultValue?: FieldValue;
  formula?: string;
  helpText?: string;
  showIn: Array<'table' | 'detail' | 'form' | 'badge' | 'print'>;
  order: number;
  archived?: boolean;
}

/** A user-defined categorical entry: status, tier, voice or item type. */
export interface Vocab {
  id: string;
  label: string;
  color?: string; // token name ('tier-1') or raw color
  order: number;
  /** Terminal states end the pipeline (e.g. arrived, no-show). */
  terminal?: boolean;
  /** Marks the vocab entry that means "this guest is in the room". */
  meansArrived?: boolean;
  archived?: boolean;
}

export interface SchemaConfig {
  fields: FieldDef[];
  guestStatuses: Vocab[];
  eventStatuses: Vocab[];
  tiers: Vocab[];
  voices: Vocab[];
  cueTypes: Vocab[];
  platforms: Vocab[];
}

/* ---------------------------------------------------------------- metrics */

export interface WeightTable {
  id: string;
  label: string;
  keyedBy: 'voiceId' | 'tierId' | 'platform';
  entries: Record<string, number>;
  fallback: number;
}

export interface MetricVariable {
  id: string;
  label: string;
  /** Where the value comes from on a guest record. */
  source:
    | { kind: 'field'; path: string }
    | { kind: 'weight'; table: string }
    | { kind: 'constant'; value: number };
  fallback?: number;
}

export interface MetricConfig {
  id: string;
  label: string;
  description?: string;
  formula: string;
  variables: MetricVariable[];
  weightTables: WeightTable[];
  format: { style: 'currency' | 'number' | 'percent'; currency?: string; decimals: number };
  breakdown: string[];
  builtinPreset?: 'miv' | 'emv';
}

/* ------------------------------------------------------------- workspaces */

export interface Workspace extends Timestamped {
  id: ULID;
  name: string;
  brand: BrandTokens;
  schema: SchemaConfig;
  metrics: MetricConfig[];
  enabledModules: ModuleKey[];
  demo: boolean;
}

export interface Venue {
  name: string;
  address?: string;
  room?: string;
  notes?: string;
}

export interface Event extends Timestamped {
  id: ULID;
  workspaceId: ULID;
  name: string;
  kind: string;
  statusId: string;
  startsAt: ISODate;
  endsAt: ISODate;
  timezone: string;
  doorsAt?: ISODate;
  venue: Venue;
  capacity: number | null;
  coverAssetId?: ULID;
  theme: ThemeOverride | null;
  fields: Record<string, FieldValue>;
  moduleOverrides: Partial<Record<ModuleKey, boolean>>;
  templateId?: string;
}

/* ------------------------------------------------------------------ guests */

export interface AudienceStats {
  followers?: number;
  avgEngagementRate?: number;
  platform?: string;
  impressions?: number;
  contentQuality?: number; // 0..1, producer-assessed
}

export interface Guest extends Timestamped {
  id: ULID;
  eventId: ULID;
  name: string;
  handle?: string;
  companyId?: ULID;
  company?: string;
  role?: string;
  tierId?: string;
  voiceId?: string;
  statusId: string;
  email?: string;
  phone?: string;
  plusOnes: number;
  seatId?: ULID;
  audience?: AudienceStats;
  scores?: Record<string, { value: number; hash: string; parts?: Record<string, number> }>;
  tags: string[];
  notes?: string;
  fields: Record<string, FieldValue>;
  qrToken: string;
}

export interface Company extends Timestamped {
  id: ULID;
  eventId: ULID;
  name: string;
  kind?: string;
  fields: Record<string, FieldValue>;
}

/* ----------------------------------------------------------------- rundown */

export interface RundownColumn {
  id: string;
  label: string;
  type: 'text' | 'longtext' | 'select' | 'checkbox' | 'person';
  options?: string[];
  width: number;
  color?: string;
  printed: boolean;
}

export interface CueAnchor {
  at: ISODate;
  mode: 'hard' | 'soft';
}

export interface Cue {
  id: ULID;
  label: string;
  durationSec: Seconds;
  itemTypeId?: string;
  anchor?: CueAnchor;
  cells: Record<string, FieldValue>;
  notes?: string;
  prompter?: string;
  actualStart?: ISODate;
  actualDurationSec?: Seconds;
  done?: boolean;
  blockId?: string;
}

export interface RundownMeta {
  eventId: ULID;
  showStart: ISODate;
  columns: RundownColumn[];
  callerCueId: ULID | null;
  message?: { text: string; at: ISODate; flash?: boolean } | null;
}

/* ----------------------------------------------------------------- seating */

export interface Seat {
  id: ULID;
  label: string;
  guestId?: ULID;
  locked?: boolean;
  tierHint?: string;
}

export type SeatingElement =
  | {
      kind: 'stage' | 'runway' | 'prop' | 'entrance' | 'bar';
      id: ULID;
      zoneId?: string;
      label: string;
      x: number;
      y: number;
      w: number;
      h: number;
      rotation: number;
    }
  | {
      kind: 'table';
      id: ULID;
      zoneId?: string;
      label: string;
      shape: 'round' | 'rect';
      x: number;
      y: number;
      w: number;
      h: number;
      rotation: number;
      seats: Seat[];
    }
  | {
      kind: 'row';
      id: ULID;
      zoneId?: string;
      label: string;
      x: number;
      y: number;
      w: number;
      h: number;
      rotation: number;
      seats: Seat[];
    };

export interface Zone {
  id: string;
  label: string;
  color?: string;
  order: number;
}

export interface SeatingRule {
  id: string;
  type: 'seat-together' | 'keep-apart' | 'tier-in-zone' | 'max-per-table';
  label?: string;
  subjects: ULID[];
  tierId?: string;
  zoneId?: string;
  limit?: number;
  severity: 'warn' | 'block';
}

export interface SeatingMap extends Timestamped {
  id: ULID;
  eventId: ULID;
  name: string;
  canvas: { width: number; height: number; gridSize: number };
  zones: Zone[];
  elements: SeatingElement[];
  rules: SeatingRule[];
}

/* ---------------------------------------------------------------- check-in */

export interface Arrival {
  id: ULID;
  eventId: ULID;
  guestId: ULID;
  at: ISODate;
  method: 'qr' | 'search' | 'walk-in' | 'manual';
  deviceId: string;
  partySize: number;
  undone?: boolean;
}

/* --------------------------------------------------------------- telemetry */

export interface TelemetryPoint {
  t: ISODate;
  v: number;
}

export interface TelemetrySeries {
  id: ULID;
  eventId: ULID;
  source: string;
  metric: string;
  unit: string;
  points: TelemetryPoint[];
  thresholds?: { warn?: number; critical?: number };
}

/* --------------------------------------------------------------- dashboard */

export interface WidgetInstance {
  id: string;
  widgetKey: string;
  settings: Record<string, FieldValue>;
  layout: { x: number; y: number; w: number; h: number };
}

export interface Dashboard extends Timestamped {
  id: ULID;
  eventId: ULID;
  name: string;
  widgets: WidgetInstance[];
}

/* ------------------------------------------------------------------ assets */

export interface Asset {
  id: ULID;
  eventId?: ULID;
  workspaceId: ULID;
  kind: 'cover' | 'logo' | 'badge' | 'other';
  mime: string;
  width?: number;
  height?: number;
  blob: Blob;
  createdAt: ISODate;
}

/* --------------------------------------------------------------- templates */

export interface EventTemplate {
  id: string;
  workspaceId?: ULID;
  name: string;
  kind: string;
  description: string;
  accent: string;
  schemaPatch: Partial<SchemaConfig>;
  rundownColumns: RundownColumn[];
  enabledModules: ModuleKey[];
  metricIds: string[];
  seatingPreset?: 'runway' | 'theatre' | 'banquet' | 'open-floor' | 'none';
  builtin?: boolean;
}

/* ------------------------------------------------------------- saved views */

export interface SavedView {
  id: ULID;
  workspaceId: ULID;
  entity: FieldEntity;
  name: string;
  filters: ViewFilter[];
  sort: Array<{ id: string; desc: boolean }>;
  groupBy?: string;
  columns: { order: string[]; hidden: string[]; widths: Record<string, number> };
  density: 'compact' | 'comfortable';
  viewType: 'table' | 'board';
  pinned?: boolean;
  isDefault?: boolean;
}

export interface ViewFilter {
  field: string;
  op: 'is' | 'is-not' | 'contains' | 'gt' | 'lt' | 'between' | 'is-empty' | 'is-not-empty';
  value?: FieldValue;
  value2?: FieldValue;
}
