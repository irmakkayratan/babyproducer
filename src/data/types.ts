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
  | 'advancing'
  | 'checkin'
  | 'command'
  | 'metrics'
  | 'settlement';

export const ALL_MODULES: ModuleKey[] = [
  'guests',
  'seating',
  'rundown',
  'advancing',
  'checkin',
  'command',
  'metrics',
  'settlement',
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
  /**
   * Kept so a workspace exported before the product went black and white still
   * imports cleanly. Nothing reads it: there is one palette now.
   */
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
  /** Headings the advance checklist is grouped under. */
  advanceSections: Vocab[];
  /** Who the people you advance and settle with are to you. */
  partyRoles: Vocab[];
  /** How show costs are grouped on a settlement statement. */
  expenseCategories: Vocab[];
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

/* -------------------------------------------------------------- advancing */

/**
 * Advancing is the pre-production pass: every logistical, technical and
 * hospitality detail agreed with the venue, the crew and the travelling party
 * before anyone gets on a plane. The model is deliberately a flat checklist of
 * items grouped by a user-defined section, because that is what an advance
 * actually is, a list of questions that must all end up answered.
 */
export type AdvanceStatus = 'missing' | 'requested' | 'confirmed' | 'na';

export const ADVANCE_STATUSES: AdvanceStatus[] = ['missing', 'requested', 'confirmed', 'na'];

export type AdvanceLogisticsKind = 'travel' | 'stay' | 'transfer' | 'schedule' | 'spec';

/**
 * The structured half of an item. Everything here is optional: an advance
 * starts as prose ("they want to land the day before") and hardens into times
 * and reference numbers as it gets confirmed.
 */
export interface AdvanceLogistics {
  kind: AdvanceLogisticsKind;
  /** Carrier, property or supplier, whoever is holding the booking. */
  provider?: string;
  /** Booking reference, confirmation number or flight number. */
  reference?: string;
  from?: string;
  to?: string;
  startsAt?: ISODate;
  endsAt?: ISODate;
  /** Rooms, vehicles, seats, channels. Whatever the item is counted in. */
  quantity?: number;
  unit?: string;
}

export interface AdvanceItem {
  id: ULID;
  sectionId: string;
  /** Which travelling party the item belongs to, if any. */
  partyId?: ULID;
  label: string;
  status: AdvanceStatus;
  /** A required item that is not confirmed blocks the advance. */
  required: boolean;
  /** Who owes the answer. Free text so it can name a person or a company. */
  owner?: string;
  dueAt?: ISODate;
  /** The answer itself, in whatever form it arrived. */
  detail?: string;
  notes?: string;
  logistics?: AdvanceLogistics;
  updatedAt: ISODate;
}

/** A travelling group: the people an advance is run for. */
export interface AdvanceParty {
  id: ULID;
  name: string;
  roleId?: string;
  headcount: number;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
}

/** Someone to call on the day. */
export interface AdvanceContact {
  id: ULID;
  name: string;
  role?: string;
  company?: string;
  email?: string;
  phone?: string;
}

export interface AdvanceSheet extends Timestamped {
  id: ULID;
  eventId: ULID;
  parties: AdvanceParty[];
  contacts: AdvanceContact[];
  items: AdvanceItem[];
  notes?: string;
  /** Stamped when the sheet is sent out, so a re-send is a deliberate act. */
  sentAt?: ISODate;
}

/* ------------------------------------------------------------- settlement */

/**
 * Settlement is the financial mirror of advancing: what the show actually
 * took, what it cost, and who is owed what once the contract is applied.
 *
 * The sheet stores only inputs. Every figure on the statement is derived by
 * `computeSettlement()`, the same principle as the rundown's start times, and
 * for the same reason: a stored total is a total that can go stale.
 */
export interface TicketTier {
  id: string;
  label: string;
  price: number;
  /** How many were available to sell at this price. */
  allotment: number;
  sold: number;
  /** Papered seats: they fill the room and earn nothing. */
  comps: number;
}

export type LineBasis = 'fixed' | 'percent-gross' | 'percent-adjusted' | 'per-ticket' | 'per-head';

export interface SettlementLine {
  id: string;
  label: string;
  categoryId?: string;
  basis: LineBasis;
  /** Money for `fixed`, a percentage for `percent-*`, a rate for `per-*`. */
  amount: number;
  notes?: string;
}

export type DealKind = 'flat' | 'percentage' | 'versus' | 'plus-bonus';

/** What a percentage is taken from, in the order the statement computes them. */
export type DealBasis = 'gross' | 'adjusted' | 'net';

export interface DealTerms {
  kind: DealKind;
  /** The fee that is owed whatever the box office does. */
  guarantee: number;
  /** Percentage (0–100) of the basis. */
  percentage: number;
  basis: DealBasis;
  /** `plus-bonus` only: the figure the bonus percentage applies above. */
  breakeven: number;
}

export interface SettlementParty {
  id: ULID;
  name: string;
  roleId?: string;
  deal: DealTerms;
  /** Already paid at signature. Comes off the balance, and the fee stands. */
  deposit: number;
  /** Percentage (0–100) withheld at source from the fee. */
  withholdingPercent: number;
  /** Buyouts, extras and recharges: negative amounts reduce the payout. */
  adjustments: SettlementLine[];
  notes?: string;
}

export interface SettlementSheet extends Timestamped {
  id: ULID;
  eventId: ULID;
  currency: string;
  /** A finalized sheet is read-only until it is explicitly reopened. */
  finalizedAt?: ISODate;
  preparedBy?: string;
  scaling: TicketTier[];
  otherRevenue: SettlementLine[];
  /** Taken off the top before anyone splits anything: taxes, ticketing fees. */
  deductions: SettlementLine[];
  /** The cost of putting the show on. */
  expenses: SettlementLine[];
  parties: SettlementParty[];
  notes?: string;
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
  /** Seeds weight-table entries: { metricId: { tableId: { key: weight } } }. */
  metricWeights?: Record<string, Record<string, Record<string, number>>>;
  seatingPreset?: 'runway' | 'theatre' | 'banquet' | 'open-floor' | 'none';
  /** Extra checklist entries, appended to the neutral default advance. */
  advanceChecklist?: AdvanceChecklistEntry[];
  /** The settlement scaffold: scaling, standing costs and the default deal. */
  settlementPreset?: SettlementPreset;
  builtin?: boolean;
}

/** A checklist line as a template stores it, before it becomes an item. */
export interface AdvanceChecklistEntry {
  sectionId: string;
  label: string;
  required?: boolean;
  owner?: string;
  /** Deadline expressed relative to the event, in days before it starts. */
  dueDaysBefore?: number;
  logisticsKind?: AdvanceLogisticsKind;
  /** Repeat the item once for each travelling party. */
  perParty?: boolean;
}

export interface SettlementPreset {
  currency: string;
  scaling: Array<Pick<TicketTier, 'label' | 'price' | 'allotment'>>;
  deductions: Array<Omit<SettlementLine, 'id'>>;
  expenses: Array<Omit<SettlementLine, 'id'>>;
  deal: DealTerms;
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
