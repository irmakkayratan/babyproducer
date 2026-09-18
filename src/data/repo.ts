/**
 * Repository layer: every durable read and write goes through here, so slices
 * stay thin and the Dexie surface is testable on its own.
 */
import { backfillSchema, db, getMeta, setMeta } from './db';
import { buildAdvanceSheet } from './advancing';
import { buildSettlementSheet } from './settlement';
import { defaultBrand, defaultMetrics, defaultModules, defaultSchema, DEFAULT_RUNDOWN_COLUMNS } from './defaults';
import { getTemplate } from './templates';
import type {
  Event,
  EventTemplate,
  MetricConfig,
  SchemaConfig,
  ThemeOverride,
  Venue,
  Vocab,
  Workspace,
} from './types';
import { ulid } from '@/lib/id';

const now = () => new Date().toISOString();

function stamp<T extends object>(value: T): T & { createdAt: string; updatedAt: string; rev: number } {
  const t = now();
  return { ...value, createdAt: t, updatedAt: t, rev: 1 };
}

/* ------------------------------------------------------------- workspaces */

export async function listWorkspaces(): Promise<Workspace[]> {
  const workspaces = await db.workspaces.toArray();
  return workspaces.map((workspace) => ({ ...workspace, schema: backfillSchema(workspace.schema) }));
}

export async function getWorkspace(id: string): Promise<Workspace | undefined> {
  const workspace = await db.workspaces.get(id);
  return workspace && { ...workspace, schema: backfillSchema(workspace.schema) };
}

export async function createWorkspace(input: {
  name: string;
  demo?: boolean;
  template?: EventTemplate;
}): Promise<Workspace> {
  const template = input.template;
  const schema = template ? applyTemplateToSchema(defaultSchema(), template, true) : defaultSchema();
  const metrics = template ? applyTemplateWeights(defaultMetrics(), template) : defaultMetrics();
  const workspace: Workspace = stamp({
    id: ulid(),
    name: input.name,
    brand: { ...defaultBrand(), ...(template ? { accent: template.accent } : {}) },
    schema,
    metrics,
    enabledModules: template?.enabledModules ?? defaultModules(),
    demo: input.demo ?? false,
  });
  await db.workspaces.put(workspace);
  return workspace;
}

export async function updateWorkspace(
  id: string,
  patch: Partial<Omit<Workspace, 'id'>>,
): Promise<Workspace | undefined> {
  const existing = await db.workspaces.get(id);
  if (!existing) return undefined;
  const next: Workspace = { ...existing, ...patch, updatedAt: now(), rev: existing.rev + 1 };
  await db.workspaces.put(next);
  return next;
}

/**
 * A workspace still using untouched defaults adopts a template's vocabulary
 * wholesale; one the user has already shaped only gains the entries it lacks.
 * Either way nothing the user wrote is ever discarded.
 */
export function applyTemplateToSchema(
  schema: SchemaConfig,
  template: EventTemplate,
  freshWorkspace = false,
): SchemaConfig {
  const defaults = defaultSchema();
  const next: SchemaConfig = backfillSchema(schema);
  const keys = [
    'voices',
    'tiers',
    'guestStatuses',
    'eventStatuses',
    'cueTypes',
    'platforms',
    'advanceSections',
    'partyRoles',
    'expenseCategories',
  ] as const;

  for (const key of keys) {
    const patch = template.schemaPatch[key] as Vocab[] | undefined;
    if (!patch?.length) continue;
    // Read through the backfilled copy: a workspace written before a
    // vocabulary list existed has no entry to compare against.
    const current = next[key];
    const isPristine = freshWorkspace || sameVocab(current, defaults[key]);
    next[key] = isPristine ? [...patch] : unionVocab(current, patch);
  }

  if (template.schemaPatch.fields?.length) {
    const existingIds = new Set(schema.fields.map((f) => f.id));
    next.fields = [...schema.fields, ...template.schemaPatch.fields.filter((f) => !existingIds.has(f.id))];
  }
  return next;
}

/**
 * Weight tables a template supplies fill in only where the user has not set a
 * value, so re-applying a template never overwrites a tuned weight.
 */
export function applyTemplateWeights(metrics: MetricConfig[], template: EventTemplate): MetricConfig[] {
  if (!template.metricWeights) return metrics;
  return metrics.map((metric) => {
    const patch = template.metricWeights?.[metric.id];
    if (!patch) return metric;
    return {
      ...metric,
      weightTables: metric.weightTables.map((table) => {
        const entries = patch[table.id];
        return entries ? { ...table, entries: { ...entries, ...table.entries } } : table;
      }),
    };
  });
}

function sameVocab(a: Vocab[], b: Vocab[]): boolean {
  return a.length === b.length && a.every((entry, i) => entry.id === b[i].id && entry.label === b[i].label);
}

function unionVocab(current: Vocab[], patch: Vocab[]): Vocab[] {
  const byId = new Map(current.map((entry) => [entry.id, entry]));
  let order = current.length;
  for (const entry of patch) {
    if (!byId.has(entry.id)) byId.set(entry.id, { ...entry, order: order++ });
  }
  return [...byId.values()].sort((a, b) => a.order - b.order);
}

/* ----------------------------------------------------------------- events */

export async function listEvents(workspaceId: string): Promise<Event[]> {
  const events = await db.events.where('workspaceId').equals(workspaceId).toArray();
  return events.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export async function getEvent(id: string): Promise<Event | undefined> {
  return db.events.get(id);
}

export interface CreateEventInput {
  workspaceId: string;
  name: string;
  subtitle?: string;
  templateId?: string;
  startsAt: string;
  endsAt?: string;
  doorsAt?: string;
  timezone?: string;
  venue?: Venue;
  capacity?: number | null;
  theme?: ThemeOverride | null;
}

export async function createEvent(input: CreateEventInput): Promise<Event> {
  const template = getTemplate(input.templateId ?? 'blank');
  // A start the browser cannot read would otherwise reach `toISOString` as NaN
  // and throw, losing the event the user just filled in a form for.
  const startMs = new Date(input.startsAt).getTime();
  const startsAt = Number.isFinite(startMs) ? input.startsAt : new Date().toISOString();
  const endsAt =
    input.endsAt ?? new Date((Number.isFinite(startMs) ? startMs : Date.now()) + 3 * 3600_000).toISOString();

  const event: Event = stamp({
    id: ulid(),
    workspaceId: input.workspaceId,
    name: input.name,
    subtitle: input.subtitle,
    kind: template.kind,
    statusId: 'planning',
    startsAt,
    endsAt,
    doorsAt: input.doorsAt,
    timezone: input.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    venue: input.venue ?? { name: '' },
    capacity: input.capacity ?? null,
    theme: input.theme ?? { accent: template.accent },
    fields: {},
    moduleOverrides: {},
    templateId: template.id,
  });

  await db.transaction('rw', db.events, db.workspaces, db.advanceSheets, db.settlements, async () => {
    await db.events.put(event);
    // Advancing and settlement start with the event itself, well before a visit
    // to their tab: the checklist is what turns a booking into a production,
    // and the deal is agreed long before the box office opens.
    await db.advanceSheets.put(buildAdvanceSheet(event));
    await db.settlements.put(buildSettlementSheet(event));
    const workspace = await db.workspaces.get(input.workspaceId);
    if (workspace) {
      await db.workspaces.put({
        ...workspace,
        schema: applyTemplateToSchema(workspace.schema, template),
        metrics: applyTemplateWeights(workspace.metrics, template),
        updatedAt: now(),
        rev: workspace.rev + 1,
      });
    }
  });

  // The rundown document itself is created lazily by the rundown module; its
  // column set comes from the template.
  await setMeta(`rundown:columns:${event.id}`, template.rundownColumns ?? DEFAULT_RUNDOWN_COLUMNS);
  return event;
}

export async function updateEvent(id: string, patch: Partial<Omit<Event, 'id'>>): Promise<Event | undefined> {
  const existing = await db.events.get(id);
  if (!existing) return undefined;
  const next: Event = { ...existing, ...patch, updatedAt: now(), rev: existing.rev + 1 };
  await db.events.put(next);
  return next;
}

export async function deleteEvent(id: string): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.events,
      db.guests,
      db.companies,
      db.seatingMaps,
      db.arrivals,
      db.telemetry,
      db.dashboards,
      db.rundowns,
      db.advanceSheets,
      db.settlements,
      db.meta,
    ],
    async () => {
      await Promise.all([
        db.events.delete(id),
        db.advanceSheets.where('eventId').equals(id).delete(),
        db.settlements.where('eventId').equals(id).delete(),
        db.guests.where('eventId').equals(id).delete(),
        db.companies.where('eventId').equals(id).delete(),
        db.seatingMaps.where('eventId').equals(id).delete(),
        db.arrivals.where('eventId').equals(id).delete(),
        db.telemetry.where('eventId').equals(id).delete(),
        db.dashboards.where('eventId').equals(id).delete(),
        db.rundowns.delete(id),
        // `createEvent` writes the rundown's column set into `meta`; without
        // this the row outlives the event it describes, and a workspace that
        // has cycled through a season of events carries every one of them.
        db.meta.delete(`rundown:columns:${id}`),
      ]);
    },
  );
}

/* -------------------------------------------------------------- bootstrap */

/** First run: make sure there is somewhere to work. */
export async function ensureBootstrapped(): Promise<{ workspaces: Workspace[]; firstRun: boolean }> {
  const workspaces = await listWorkspaces();
  if (workspaces.length > 0) return { workspaces, firstRun: false };
  const firstRunDone = await getMeta('firstRunDone', false);
  return { workspaces, firstRun: !firstRunDone };
}
